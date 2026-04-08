//+------------------------------------------------------------------+
//|                                         XAUUSD_MultiTF_EA.mq5   |
//|                   EA Giao Dịch Vàng Đa Khung Thời Gian v1.0     |
//|                                                                   |
//| Cặp giao dịch  : XAUUSD                                         |
//| Khung phân tích : H4, H1, M15, M5                               |
//| Khung entry     : M5                                             |
//| Đơn vị giá      : 1 giá = $1 (ví dụ 1200->1210 = 10 giá)        |
//+------------------------------------------------------------------+
#property copyright   "XAUUSD Multi-TF EA v1.0"
#property link        ""
#property version     "1.00"
#property description "EA giao dịch XAUUSD theo xu hướng đa khung H4/H1/M15/M5"
#property strict


//+------------------------------------------------------------------+
//| INPUT PARAMETERS - Tất cả thông số người dùng có thể tùy chỉnh  |
//+------------------------------------------------------------------+

//--- Nhóm EMA
input group           "=== CÀI ĐẶT EMA ==="
input int    InpEMAFast        = 8;      // EMA Fast Period (H1 crossover, M5 entry)
input int    InpEMASlow        = 21;     // EMA Slow Period (H1/H4/M15 xu hướng)

//--- Nhóm ADX
input group           "=== CÀI ĐẶT ADX ==="
input int    InpADXPeriod      = 14;     // ADX Period
input double InpADXMin         = 25.0;   // ADX tối thiểu để vào lệnh (>25 cho phép)
input double InpADXMax         = 40.0;   // ADX tối đa (>40 xu hướng kiệt sức, bỏ qua)

//--- Nhóm ATR
input group           "=== CÀI ĐẶT ATR ==="
input int    InpATRPeriod      = 14;     // ATR Period (dùng tính buffer cho SL trên M5)

//--- Quản lý lệnh
input group           "=== QUẢN LÝ LỆNH ==="
input double InpMaxSLGia       = 30.0;   // Max SL tính bằng giá ($30) - bỏ qua nếu vượt
input double InpVolume1        = 0.1;    // Volume lệnh 1 (lot)
input double InpVolume2        = 0.3;    // Volume lệnh 2 (lot)

//--- Bộ lọc an toàn
input group           "=== BỘ LỌC AN TOÀN ==="
input double InpMaxSpreadGia   = 30.0;   // Max spread tính bằng giá ($) - tránh giờ cao điểm
input int    InpMaxDailyTrades = 10;     // Số lệnh tối đa mỗi ngày (reset 00:00 GMT)
input int    InpMaxConsecLoss  = 3;      // Số lệnh thua liên tiếp tối đa trước khi dừng
input bool   InpNewsFilter     = true;   // Bật/tắt bộ lọc tin tức tự động
input bool   InpPartialCloseTP1= true;   // Dong 50%% L1 tai TP1 (lock profit, SL->entry)
input int    InpMaxHoldBarsH1  = 12;     // Tu dong dong sau X bars H1 neu chua TP1 (0=tat)
input double InpL2TriggerPct   = 0.70;   // Kich hoat L2 o X%% khoang cach SL (mac dinh 70%%)
input int    InpRSIPeriodL2    = 14;     // RSI period cho bo loc L2
input double InpRSILevelL2     = 35.0;  // RSI nguong: Buy L2 chi khi RSI<35, Sell L2 khi RSI>65
input double InpDailyDDPct     = 3.0;   // Max drawdown trong ngay (%% balance) truoc khi dung bot
input double InpTrailATRMult   = 1.5;   // ATR M15 multiplier cho trailing SL sau khi dat TP1

//--- Cài đặt hệ thống
input group           "=== CÀI ĐẶT HỆ THỐNG ==="
input int    InpMagicNumber    = 202501; // Magic Number - nhận diện lệnh của EA này
input int    InpSlippage       = 30;     // Slippage tối đa chấp nhận (points)


//+------------------------------------------------------------------+
//| INDICATOR HANDLES - Tạo 1 lần trong OnInit, dùng lại mỗi tick  |
//+------------------------------------------------------------------+
int g_d1EMA21Handle    = INVALID_HANDLE;  // EMA21 tren D1 (bo loc khung ngay)
int g_h4EMA21Handle    = INVALID_HANDLE;  // EMA21 tren H4
int g_h1EMAFastHandle  = INVALID_HANDLE;  // EMA Fast (mặc định EMA8) trên H1
int g_h1EMASlowHandle  = INVALID_HANDLE;  // EMA Slow (mặc định EMA21) trên H1
int g_h1ADXHandle      = INVALID_HANDLE;  // ADX trên H1
int g_m15EMA21Handle   = INVALID_HANDLE;  // EMA21 trên M15
int g_m5EMAFastHandle  = INVALID_HANDLE;  // EMA Fast trên M5
int g_m5ATRHandle      = INVALID_HANDLE;  // ATR trên M5
int g_m5RSIHandle      = INVALID_HANDLE;  // RSI tren M5 (loc L2: tranh averaging vao momentum manh)
int g_m15ATRHandle     = INVALID_HANDLE;  // ATR tren M15 (trailing SL sau TP1)

//+------------------------------------------------------------------+
//| BIẾN TRẠNG THÁI TOÀN CỤC                                         |
//+------------------------------------------------------------------+

//--- Thống kê hàng ngày
int      g_dailyTradeCount   = 0;      // Số lệnh đã mở hôm nay
datetime g_currentDay        = 0;      // Ngày hiện tại (phát hiện ngày mới để reset)
bool     g_botPausedToday    = false;  // Đã dừng do thua liên tiếp chưa

//--- Trạng thái lệnh đang mở
bool     g_hasOrder1         = false;  // Có lệnh 1 đang mở không
bool     g_hasOrder2         = false;  // Có lệnh 2 đang mở không
ulong    g_ticket1           = 0;      // Ticket position lệnh 1
ulong    g_ticket2           = 0;      // Ticket position lệnh 2
bool     g_order2EverOpened  = false;  // Lệnh 2 đã từng mở (tránh mở nhiều lần)
double   g_entry2            = 0.0;   // Gia entry lenh 2 (de kiem tra L2 co loi truoc khi dong)

//--- Thông số giao dịch đang mở
int      g_tradeDir          = 0;      // Chiều GD: 1=Buy, -1=Sell
double   g_entry1            = 0.0;   // Giá entry lệnh 1
double   g_sl                = 0.0;   // SL chung (cả 2 lệnh dùng chung)
double   g_tp1               = 0.0;   // TP1 (RR 1:2) - quản lý thủ công
double   g_tp2               = 0.0;   // TP2 (RR 1:3) - đặt trực tiếp vào lệnh
bool     g_tp1Reached        = false; // Cờ đã đạt TP1 chưa (cho trailing)

//--- Chống tín hiệu lặp trong cùng 1 bar M5
datetime g_lastSignalBar     = 0;

//--- Thoi gian mo lenh 1 (de time-based exit)
datetime g_tradeOpenTime     = 0;


//+------------------------------------------------------------------+
//| KHỞI TẠO EA                                                       |
//+------------------------------------------------------------------+
int OnInit()
{
    //--- Kiểm tra symbol - EA được thiết kế cho XAUUSD
    string sym = Symbol();
    if(StringFind(sym, "XAU") < 0 && StringFind(sym, "GOLD") < 0)
    {
        Print("[CẢNH BÁO] EA thiết kế cho XAUUSD, đang chạy trên: ", sym);
        // Không return INIT_FAILED để vẫn có thể test trên demo
    }

    //--- Tạo tất cả indicator handles (tạo 1 lần, dùng lại mỗi tick - hiệu suất tốt hơn)
    g_d1EMA21Handle   = iMA(sym, PERIOD_D1,  InpEMASlow,  0, MODE_EMA, PRICE_CLOSE);
    g_h4EMA21Handle   = iMA(sym, PERIOD_H4,  InpEMASlow,  0, MODE_EMA, PRICE_CLOSE);
    g_h1EMAFastHandle = iMA(sym, PERIOD_H1,  InpEMAFast,  0, MODE_EMA, PRICE_CLOSE);
    g_h1EMASlowHandle = iMA(sym, PERIOD_H1,  InpEMASlow,  0, MODE_EMA, PRICE_CLOSE);
    g_h1ADXHandle     = iADX(sym, PERIOD_H1, InpADXPeriod);
    g_m15EMA21Handle  = iMA(sym, PERIOD_M15, InpEMASlow,  0, MODE_EMA, PRICE_CLOSE);
    g_m5EMAFastHandle = iMA(sym, PERIOD_M5,  InpEMAFast,  0, MODE_EMA, PRICE_CLOSE);
    g_m5ATRHandle     = iATR(sym, PERIOD_M5, InpATRPeriod);
    g_m5RSIHandle     = iRSI(sym, PERIOD_M5,  InpRSIPeriodL2, PRICE_CLOSE);
    g_m15ATRHandle    = iATR(sym, PERIOD_M15, InpATRPeriod);

    //--- Kiểm tra tất cả handles hợp lệ
    if(g_d1EMA21Handle   == INVALID_HANDLE ||
       g_h4EMA21Handle   == INVALID_HANDLE ||
       g_h1EMAFastHandle == INVALID_HANDLE ||
       g_h1EMASlowHandle == INVALID_HANDLE ||
       g_h1ADXHandle     == INVALID_HANDLE ||
       g_m15EMA21Handle  == INVALID_HANDLE ||
       g_m5EMAFastHandle == INVALID_HANDLE ||
       g_m5ATRHandle     == INVALID_HANDLE ||
       g_m5RSIHandle     == INVALID_HANDLE ||
       g_m15ATRHandle    == INVALID_HANDLE)
    {
        Print("[LOI NGHIEM TRONG] Khong the khoi tao indicator handles! Error: ", GetLastError());
        return INIT_FAILED;
    }

    //--- Khởi tạo ngày hiện tại để reset đếm hàng ngày
    g_currentDay = StringToTime(TimeToString(TimeCurrent(), TIME_DATE));

    //--- KHOI PHUC TRANG THAI: Neu MT5 restart khi dang co lenh, doc lai tu GlobalVariables
    RestoreStateFromGV();

    //--- In thông tin cài đặt khi khởi động
    Print("+==================================================+");
    Print("|     XAUUSD Multi-Timeframe Expert Advisor v1.0   |");
    Print("+==================================================|");
    PrintFormat("| Symbol    : %-36s |", sym);
    PrintFormat("| Magic     : %-36d |", InpMagicNumber);
    PrintFormat("| EMA       : Fast=%d  Slow=%d                     |", InpEMAFast, InpEMASlow);
    PrintFormat("| ADX       : Period=%d  Min=%.0f  Max=%.0f            |", InpADXPeriod, InpADXMin, InpADXMax);
    PrintFormat("| ATR M5    : %d                                    |", InpATRPeriod);
    PrintFormat("| Max SL    : $%.0f  Max Spread: $%.0f               |", InpMaxSLGia, InpMaxSpreadGia);
    PrintFormat("| Volume    : L1=%.2f lot  L2=%.2f lot            |", InpVolume1, InpVolume2);
    PrintFormat("| Giới hạn  : %d lệnh/ngày, thua tối đa %d lệnh   |", InpMaxDailyTrades, InpMaxConsecLoss);
    Print("| Session   : 07:00 - 16:00 GMT (14:00-23:00 VN)  |");
    Print("+==================================================+");

    return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
//| DỪNG EA - Giải phóng tài nguyên                                  |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
    //--- Giải phóng tất cả indicator handles để tránh rò rỉ bộ nhớ
    if(g_d1EMA21Handle   != INVALID_HANDLE) IndicatorRelease(g_d1EMA21Handle);
    if(g_h4EMA21Handle   != INVALID_HANDLE) IndicatorRelease(g_h4EMA21Handle);
    if(g_h1EMAFastHandle != INVALID_HANDLE) IndicatorRelease(g_h1EMAFastHandle);
    if(g_h1EMASlowHandle != INVALID_HANDLE) IndicatorRelease(g_h1EMASlowHandle);
    if(g_h1ADXHandle     != INVALID_HANDLE) IndicatorRelease(g_h1ADXHandle);
    if(g_m15EMA21Handle  != INVALID_HANDLE) IndicatorRelease(g_m15EMA21Handle);
    if(g_m5EMAFastHandle != INVALID_HANDLE) IndicatorRelease(g_m5EMAFastHandle);
    if(g_m5ATRHandle     != INVALID_HANDLE) IndicatorRelease(g_m5ATRHandle);
    if(g_m5RSIHandle     != INVALID_HANDLE) IndicatorRelease(g_m5RSIHandle);
    if(g_m15ATRHandle    != INVALID_HANDLE) IndicatorRelease(g_m15ATRHandle);

    Print("[EA] XAUUSD Multi-TF EA dung. Ly do: ", reason);
}


//+------------------------------------------------------------------+
//| MAIN TICK - Hàm xử lý chính, gọi mỗi khi có giá mới            |
//+------------------------------------------------------------------+
void OnTick()
{
    //--- Bước 1: Reset bộ đếm hàng ngày khi sang ngày mới (00:00 GMT)
    CheckAndResetDaily();

    //--- Bước 2: Equity guard - dung bot neu drawdown trong ngay vuot nguong
    if(InpDailyDDPct > 0)
    {
        double balance  = AccountInfoDouble(ACCOUNT_BALANCE);
        double equity   = AccountInfoDouble(ACCOUNT_EQUITY);
        double ddPct    = (balance > 0) ? (balance - equity) / balance * 100.0 : 0.0;
        if(ddPct >= InpDailyDDPct)
        {
            g_botPausedToday = true;
            LogThrottled("EQUITY_DD",
                StringFormat("[EQUITY] Drawdown %.2f%% >= %.2f%% -> Dung bot bao ve von",
                    ddPct, InpDailyDDPct),
                3600);
            return;
        }
    }

    //--- Nếu bot đang dừng do thua liên tiếp, không làm gì
    if(g_botPausedToday)
    {
        LogThrottled("PAUSED",
            "[DỪNG] Bot tạm dừng hôm nay (thua " +
            IntegerToString(InpMaxConsecLoss) + " lệnh liên tiếp). Sẽ tiếp tục ngày mai.",
            3600);
        return;
    }

    //--- Bước 3: Đồng bộ trạng thái lệnh với thực tế (phát hiện lệnh đã đóng)
    SyncPositionState();

    //--- Bước 4: Nếu đang có lệnh mở -> quản lý trailing/lệnh 2, không mở thêm
    if(g_hasOrder1 || g_hasOrder2)
    {
        ManageOpenPositions();
        return;
    }

    //--- Bước 5: Kiểm tra giới hạn lệnh trong ngày
    if(g_dailyTradeCount >= InpMaxDailyTrades)
    {
        LogThrottled("MAX_TRADES",
            "[GIỚI HẠN] Đã đạt " + IntegerToString(InpMaxDailyTrades) + " lệnh hôm nay",
            3600);
        return;
    }

    //--- Bước 6: Chỉ kiểm tra tín hiệu khi có bar M5 MỚI (tránh vào lệnh lặp trong cùng bar)
    datetime curBar = iTime(Symbol(), PERIOD_M5, 0);
    if(curBar == g_lastSignalBar) return;

    //--- Bước 7: Bộ lọc an toàn (session, spread, tin tức)
    if(!FilterSession())               return;
    if(!FilterSpread())                return;
    if(InpNewsFilter && !FilterNews()) return;

    //--- Bước 8: Bo loc D1 - Khung ngay (lop loc cao nhat)
    //    Chi giao dich khi D1 cung chieu -> tranh giao dich nguoc xu huong chinh
    int d1Dir = GetD1Filter();
    if(d1Dir == 0)
    {
        LogThrottled("D1", "[LOC D1] Khung ngay khong ro xu huong -> Bo qua", 3600);
        return;
    }

    //--- Bước 9: Phân tích H4 - Xu hướng chính
    int h4Dir = GetH4Trend();
    if(h4Dir == 0) return;

    //--- Bước 9b: D1 và H4 phải cùng chiều
    if(d1Dir != h4Dir)
    {
        LogThrottled("D1H4",
            "[LOC] D1(" + DirToStr(d1Dir) + ") mau thuan H4(" + DirToStr(h4Dir) + ") -> Bo qua",
            3600);
        return;
    }

    //--- Bước 10: Phân tích H1 - Sustained EMA alignment + ADX + DI
    int h1Dir = GetH1Signal();
    if(h1Dir == 0) return;

    //--- Bước 10b: Kiểm tra mâu thuẫn H4/H1 -> không vào lệnh
    if(h4Dir != h1Dir)
    {
        LogThrottled("CONFLICT",
            "[LOC] H4(" + DirToStr(h4Dir) + ") mau thuan H1(" + DirToStr(h1Dir) + ") -> Bo qua",
            1800);
        return;
    }

    int signalDir = h4Dir; // D1, H4, H1 da dong thuan

    //--- Bước 11: Giá phải pullback về EMA21 H1 (không đuổi giá)
    if(!CheckPullbackToEMA21H1(signalDir))
    {
        LogThrottled("PULLBACK", "[LỌC] Chưa pullback về EMA21 H1 -> Không đuổi giá", 900);
        return;
    }

    //--- Bước 12: M15 xác nhận xu hướng cùng chiều
    if(!ConfirmM15Trend(signalDir))
    {
        LogThrottled("M15", "[LỌC] M15 không xác nhận xu hướng " + DirToStr(signalDir), 900);
        return;
    }

    //--- Bước 13: Nến M5 vừa đóng phải xác nhận chiều vào lệnh
    if(!ConfirmM5ClosedCandle(signalDir))
    {
        LogThrottled("M5", "[LỌC] Nến M5 chưa xác nhận " + DirToStr(signalDir), 300);
        return;
    }

    //--- Bước 14: Tính toán entry, SL, TP1, TP2
    double entryPrice, slPrice, tp1Price, tp2Price;
    if(!CalculateSLTP(signalDir, entryPrice, slPrice, tp1Price, tp2Price))
        return; // Lý do đã được log trong hàm CalculateSLTP

    //--- Bước 15: Mở lệnh 1
    if(PlaceOrder1(signalDir, slPrice, tp1Price, tp2Price))
    {
        g_lastSignalBar = curBar; // Đánh dấu bar đã xử lý để tránh mở lại
    }
}


//+------------------------------------------------------------------+
//| HÀM LOG CÓ THROTTLE - Tránh log lặp quá nhiều trong Journal     |
//| key       : Mã nhận diện loại log                               |
//| message   : Nội dung cần in                                     |
//| intervalSec: Khoảng thời gian tối thiểu giữa 2 lần in (giây)   |
//+------------------------------------------------------------------+
void LogThrottled(const string key, const string message, const int intervalSec)
{
    // Lưu key và thời gian log cuối cùng (static = tồn tại suốt vòng đời EA)
    static string   logKeys[50];
    static datetime logTimes[50];
    static int      logCount = 0;

    datetime now = TimeCurrent();

    // Tìm key đã tồn tại
    for(int i = 0; i < logCount; i++)
    {
        if(logKeys[i] == key)
        {
            if(now - logTimes[i] >= intervalSec)
            {
                logTimes[i] = now;
                Print(message);
            }
            return;
        }
    }

    // Thêm key mới (giới hạn 50 entries)
    if(logCount < 50)
    {
        logKeys[logCount]  = key;
        logTimes[logCount] = now;
        logCount++;
        Print(message);
    }
}

//+------------------------------------------------------------------+
//| TIỆN ÍCH: Chuyển chiều giao dịch thành chuỗi hiển thị          |
//+------------------------------------------------------------------+
string DirToStr(int dir)
{
    if(dir == 1)  return "BUY";
    if(dir == -1) return "SELL";
    return "NONE";
}

//+------------------------------------------------------------------+
//| GLOBALVARIABLES PERSISTENCE - Luu/khoi phuc trang thai qua restart
//| Giai quyet: MT5 bi tat/restart khi dang co lenh -> EA "quen" SL/TP
//+------------------------------------------------------------------+
string GvPfx() { return StringFormat("EA%d_", InpMagicNumber); }

// Luu toan bo trang thai lenh vao GlobalVariables (o cung MT5, ton tai qua restart)
void SaveStateToGV()
{
    string p = GvPfx();
    GlobalVariableSet(p + "hasO1",      (double)g_hasOrder1);
    GlobalVariableSet(p + "hasO2",      (double)g_hasOrder2);
    GlobalVariableSet(p + "ticket1",    (double)g_ticket1);
    GlobalVariableSet(p + "ticket2",    (double)g_ticket2);
    GlobalVariableSet(p + "dir",        (double)g_tradeDir);
    GlobalVariableSet(p + "entry1",     g_entry1);
    GlobalVariableSet(p + "sl",         g_sl);
    GlobalVariableSet(p + "tp1",        g_tp1);
    GlobalVariableSet(p + "tp2",        g_tp2);
    GlobalVariableSet(p + "tp1Hit",     (double)g_tp1Reached);
    GlobalVariableSet(p + "o2Ever",     (double)g_order2EverOpened);
    GlobalVariableSet(p + "openTime",   (double)g_tradeOpenTime);
    GlobalVariableSet(p + "entry2",     g_entry2);
}

// Xoa GlobalVariables khi khong con lenh nao (trang thai sach)
void ClearStateGV()
{
    string p = GvPfx();
    string keys[] = {"hasO1","hasO2","ticket1","ticket2","dir","entry1",
                     "sl","tp1","tp2","tp1Hit","o2Ever","openTime","entry2"};
    for(int i = 0; i < 13; i++)
        GlobalVariableDel(p + keys[i]);
}

// Doc lai trang thai tu GlobalVariables sau khi restart
void RestoreStateFromGV()
{
    string p = GvPfx();
    // Neu khong co ban luu -> khoi dong lan dau, bo qua
    if(!GlobalVariableCheck(p + "hasO1")) return;

    g_hasOrder1        = (bool)(int)GlobalVariableGet(p + "hasO1");
    g_hasOrder2        = (bool)(int)GlobalVariableGet(p + "hasO2");
    g_ticket1          = (ulong)GlobalVariableGet(p + "ticket1");
    g_ticket2          = (ulong)GlobalVariableGet(p + "ticket2");
    g_tradeDir         = (int)GlobalVariableGet(p + "dir");
    g_entry1           = GlobalVariableGet(p + "entry1");
    g_sl               = GlobalVariableGet(p + "sl");
    g_tp1              = GlobalVariableGet(p + "tp1");
    g_tp2              = GlobalVariableGet(p + "tp2");
    g_tp1Reached       = (bool)(int)GlobalVariableGet(p + "tp1Hit");
    g_order2EverOpened = (bool)(int)GlobalVariableGet(p + "o2Ever");
    g_tradeOpenTime    = (datetime)(long)GlobalVariableGet(p + "openTime");
    g_entry2           = GlobalVariableGet(p + "entry2");

    if(g_hasOrder1 || g_hasOrder2)
    {
        Print("==================================================");
        Print("[RESTORE] Khoi phuc trang thai sau restart:");
        PrintFormat("[RESTORE] Lenh1=%s ticket=%llu | Lenh2=%s ticket=%llu",
            g_hasOrder1 ? "CO" : "KHONG", g_ticket1,
            g_hasOrder2 ? "CO" : "KHONG", g_ticket2);
        PrintFormat("[RESTORE] Dir=%s Entry=%.2f SL=%.2f TP1=%.2f TP2=%.2f TP1Hit=%s",
            DirToStr(g_tradeDir), g_entry1, g_sl, g_tp1, g_tp2,
            g_tp1Reached ? "YES" : "NO");
        Print("==================================================");
    }
}

//+------------------------------------------------------------------+
//| RETRY ORDERSEND - Thu lai 3 lan khi bi requote/busy              |
//| Xu ly loi: 10006 (Requote), 10004 (Requote), 10016 (Busy)       |
//+------------------------------------------------------------------+
bool OrderSendRetry(MqlTradeRequest &req, MqlTradeResult &res, int maxRetries = 3)
{
    for(int attempt = 1; attempt <= maxRetries; attempt++)
    {
        // Cap nhat gia moi nhat truoc moi lan thu (tranh gia cu)
        if(req.action == TRADE_ACTION_DEAL)
        {
            if(req.type == ORDER_TYPE_BUY)
                req.price = SymbolInfoDouble(req.symbol, SYMBOL_ASK);
            else if(req.type == ORDER_TYPE_SELL)
                req.price = SymbolInfoDouble(req.symbol, SYMBOL_BID);
        }

        ResetLastError();
        bool ok = OrderSend(req, res);

        if(ok && (res.retcode == TRADE_RETCODE_DONE || res.retcode == TRADE_RETCODE_PLACED))
            return true; // Thanh cong

        // Cac ma loi co the thu lai (requote, busy, server lag)
        bool retryable = (res.retcode == TRADE_RETCODE_REQUOTE   ||
                          res.retcode == TRADE_RETCODE_PRICE_OFF  ||
                          res.retcode == TRADE_RETCODE_TIMEOUT    ||
                          res.retcode == TRADE_RETCODE_CONNECTION ||
                          res.retcode == 10004);

        PrintFormat("[RETRY %d/%d] retcode=%d | %s", attempt, maxRetries, res.retcode, res.comment);

        if(!retryable || attempt == maxRetries) break;

        // Doi 200ms truoc khi thu lai (tranh spam server)
        Sleep(200);
    }
    return false;
}

//+------------------------------------------------------------------+
//| KIEM TRA RSI M5 CHO LENH 2 (Tranh averaging vao momentum manh)  |
//| Buy L2: chi khi RSI < InpRSILevelL2 (vung qua ban)              |
//| Sell L2: chi khi RSI > (100 - InpRSILevelL2) (vung qua mua)    |
//+------------------------------------------------------------------+
bool CheckRSIforL2()
{
    double rsi[];
    ArraySetAsSeries(rsi, true);
    if(CopyBuffer(g_m5RSIHandle, 0, 1, 3, rsi) <= 0)
    {
        Print("[LOI] Khong doc duoc RSI M5: ", GetLastError());
        return false; // An toan: khong mo L2 neu khong doc duoc RSI
    }

    double rsiVal    = rsi[0];
    double levelOB   = 100.0 - InpRSILevelL2; // Nguong qua mua (VD: 65)
    double levelOS   = InpRSILevelL2;          // Nguong qua ban (VD: 35)

    if(g_tradeDir == 1) // Buy L2: can RSI qua ban (gia da giam manh, co the hoi phuc)
    {
        if(rsiVal <= levelOS)
        {
            Print(StringFormat("[RSI L2] OK BUY - RSI=%.1f <= %.1f (vung qua ban)", rsiVal, levelOS));
            return true;
        }
        LogThrottled("RSI_L2_FAIL",
            StringFormat("[RSI L2] FAIL BUY - RSI=%.1f > %.1f (chua qua ban, momentum con manh)", rsiVal, levelOS),
            300);
        return false;
    }
    else // Sell L2: can RSI qua mua (gia da tang manh, co the dao chieu)
    {
        if(rsiVal >= levelOB)
        {
            Print(StringFormat("[RSI L2] OK SELL - RSI=%.1f >= %.1f (vung qua mua)", rsiVal, levelOB));
            return true;
        }
        LogThrottled("RSI_L2_FAIL",
            StringFormat("[RSI L2] FAIL SELL - RSI=%.1f < %.1f (chua qua mua, momentum con manh)", rsiVal, levelOB),
            300);
        return false;
    }
}

//+------------------------------------------------------------------+
//| LẤY FILLING TYPE HỢP LỆ VỚI BROKER                             |
//+------------------------------------------------------------------+
ENUM_ORDER_TYPE_FILLING GetFillType()
{
    // Kiểm tra broker hỗ trợ loại filling nào
    uint fillModes = (uint)SymbolInfoInteger(Symbol(), SYMBOL_FILLING_MODE);
    if((fillModes & 2) != 0) return ORDER_FILLING_IOC;    // IOC: phổ biến nhất
    if((fillModes & 1) != 0) return ORDER_FILLING_FOK;    // FOK: điền đủ hoặc hủy
    return ORDER_FILLING_RETURN;                           // RETURN: dùng cho một số MT5 server
}

//+------------------------------------------------------------------+
//| RESET BỘ ĐẾM HÀNG NGÀY - Kích hoạt lúc 00:00 GMT               |
//+------------------------------------------------------------------+
void CheckAndResetDaily()
{
    // Lấy ngày hiện tại (chỉ phần date, bỏ giờ)
    datetime todayStart = StringToTime(TimeToString(TimeCurrent(), TIME_DATE));

    if(todayStart > g_currentDay)
    {
        Print("==============================================");
        Print("[RESET NGÀY] Ngày mới: ", TimeToString(todayStart, TIME_DATE));
        PrintFormat("[RESET NGÀY] Hôm qua: %d lệnh | Bot trạng thái: %s",
            g_dailyTradeCount,
            g_botPausedToday ? "ĐÃ DỪNG" : "HOẠT ĐỘNG");
        Print("==============================================");

        // Reset tất cả bộ đếm hàng ngày
        g_dailyTradeCount  = 0;
        g_botPausedToday   = false;
        g_currentDay       = todayStart;
        g_order2EverOpened = false;
    }
}

//+------------------------------------------------------------------+
//| ĐỒNG BỘ TRẠNG THÁI LỆNH - Phát hiện lệnh đã đóng               |
//| Chạy mỗi tick khi đang có lệnh mở                               |
//+------------------------------------------------------------------+
void SyncPositionState()
{
    bool foundOrder1 = false;
    bool foundOrder2 = false;

    // Duyệt tất cả positions đang mở, tìm lệnh của EA này
    for(int i = PositionsTotal() - 1; i >= 0; i--)
    {
        ulong ticket = PositionGetTicket(i);
        if(ticket == 0) continue;
        if(!PositionSelectByTicket(ticket)) continue;

        // Lọc theo symbol và magic number
        if(PositionGetString(POSITION_SYMBOL)   != Symbol())          continue;
        if(PositionGetInteger(POSITION_MAGIC)   != InpMagicNumber)    continue;

        // Nhận biết lệnh 1 hay lệnh 2 qua comment
        string comment = PositionGetString(POSITION_COMMENT);

        if(StringFind(comment, "L1") >= 0)
        {
            foundOrder1 = true;
            g_ticket1   = ticket;
        }
        else if(StringFind(comment, "L2") >= 0)
        {
            foundOrder2 = true;
            g_ticket2   = ticket;
        }
    }

    //--- Phát hiện lệnh 1 vừa đóng (SL/TP hoặc đóng tay)
    if(g_hasOrder1 && !foundOrder1)
    {
        Print("[SYNC] Lệnh 1 đã đóng. Cập nhật thống kê thua/thắng...");
        CheckAndUpdateLossStreak(); // Kiểm tra chuỗi thua
        g_hasOrder1  = false;
        g_ticket1    = 0;
        g_tp1Reached = false;
    }

    //--- Phát hiện lệnh 2 vừa đóng
    if(g_hasOrder2 && !foundOrder2)
    {
        Print("[SYNC] Lệnh 2 đã đóng (TP/SL/manual).");
        g_hasOrder2 = false;
        g_ticket2   = 0;

        // Khi lệnh 2 đóng qua TP (tại entry lệnh 1), dời SL lệnh 1 về entry
        if(g_hasOrder1 && foundOrder1 && g_ticket1 != 0)
        {
            Print("[TRAILING] Lệnh 2 đóng -> Dời SL lệnh 1 về entry: ",
                  DoubleToString(g_entry1, 2));
            ModifyPositionSL(g_ticket1, g_entry1, false);
        }
    }

    // Cập nhật trạng thái
    g_hasOrder1 = foundOrder1;
    g_hasOrder2 = foundOrder2;

    // Reset order2 flag va thoi gian neu khong con lenh nao
    if(!g_hasOrder1 && !g_hasOrder2)
    {
        g_order2EverOpened = false;
        g_tradeOpenTime    = 0;
        g_entry2           = 0.0;
        ClearStateGV(); // Xoa ban luu khi khong con lenh
    }
    else
    {
        SaveStateToGV(); // Luu trang thai moi nhat de bao ve khi restart
    }
}

//+------------------------------------------------------------------+
//| KIỂM TRA VÀ CẬP NHẬT CHUỖI LỆNH THUA LIÊN TIẾP                |
//+------------------------------------------------------------------+
void CheckAndUpdateLossStreak()
{
    // Lấy lịch sử deals từ đầu ngày GMT đến hiện tại
    datetime todayStart = StringToTime(TimeToString(TimeCurrent(), TIME_DATE));
    if(!HistorySelect(todayStart, TimeCurrent())) return;

    int consecLoss = 0;
    int totalDeals = HistoryDealsTotal();

    // Duyệt từ deal mới nhất về trước để đếm chuỗi thua liên tiếp
    for(int i = totalDeals - 1; i >= 0; i--)
    {
        ulong dealTicket = HistoryDealGetTicket(i);
        if(dealTicket == 0) continue;

        // Lọc theo symbol và magic
        if(HistoryDealGetString(dealTicket, DEAL_SYMBOL)          != Symbol())       continue;
        if(HistoryDealGetInteger(dealTicket, DEAL_MAGIC)           != InpMagicNumber) continue;

        // Chỉ tính deals đóng lệnh (DEAL_ENTRY_OUT)
        ENUM_DEAL_ENTRY de = (ENUM_DEAL_ENTRY)HistoryDealGetInteger(dealTicket, DEAL_ENTRY);
        if(de != DEAL_ENTRY_OUT) continue;

        // Tính P&L thực tế (profit + swap + commission)
        double pnl = HistoryDealGetDouble(dealTicket, DEAL_PROFIT)
                   + HistoryDealGetDouble(dealTicket, DEAL_SWAP)
                   + HistoryDealGetDouble(dealTicket, DEAL_COMMISSION);

        if(pnl < 0)
            consecLoss++;  // Lệnh thua, tiếp tục đếm
        else
            break;         // Gặp lệnh thắng -> chuỗi thua đã bị ngắt
    }

    PrintFormat("[THỐNG KÊ] Chuỗi lệnh thua liên tiếp hôm nay: %d / %d",
                consecLoss, InpMaxConsecLoss);

    // Kích hoạt dừng bot nếu vượt ngưỡng
    if(consecLoss >= InpMaxConsecLoss)
    {
        g_botPausedToday = true;
        Print("==============================================");
        PrintFormat("[DỪNG BOT] Đã thua %d lệnh liên tiếp!", consecLoss);
        Print("[DỪNG BOT] Bot dừng giao dịch. Sẽ tự động tiếp tục vào ngày mai 00:00 GMT.");
        Print("==============================================");
    }
}


//+------------------------------------------------------------------+
//| BỘ LỌC SESSION: Chỉ giao dịch 7h-16h GMT                        |
//| = 14h-23h giờ Việt Nam                                           |
//+------------------------------------------------------------------+
bool FilterSession()
{
    // Dung TimeGMT() thay vi TimeCurrent() de dam bao dung GMT that
    // du broker dung GMT+2/+3 (server time khac GMT)
    MqlDateTime gmt;
    TimeToStruct(TimeGMT(), gmt);

    bool inSession = (gmt.hour >= 7 && gmt.hour < 16);

    if(!inSession)
        LogThrottled("SESSION",
            StringFormat("[SESSION] Ngoai gio GD | GMT: %02d:%02d | Cho phep: 07:00-16:00 GMT",
                gmt.hour, gmt.min),
            3600);

    return inSession;
}

//+------------------------------------------------------------------+
//| BỘ LỌC SPREAD: Không vào lệnh khi spread quá cao                |
//| 1 giá = 1.0 price unit (XAUUSD), ví dụ spread 0.30 = 0.30 giá  |
//+------------------------------------------------------------------+
bool FilterSpread()
{
    double point       = SymbolInfoDouble(Symbol(), SYMBOL_POINT);
    long   spreadPts   = SymbolInfoInteger(Symbol(), SYMBOL_SPREAD);
    // Đổi spread từ points sang đơn vị giá (price unit)
    // VD: XAUUSD point=0.01, spread=30pts -> 30*0.01 = 0.30 giá
    double spreadGia   = spreadPts * point;

    if(spreadGia > InpMaxSpreadGia)
    {
        LogThrottled("SPREAD",
            StringFormat("[LỌC SPREAD] Spread: %.2f giá | Max: %.0f giá -> Chờ spread hẹp hơn",
                spreadGia, InpMaxSpreadGia),
            60);
        return false;
    }
    return true;
}

//+------------------------------------------------------------------+
//| BO LOC TIN TUC: Dung MQL5 Calendar API (chinh xac, tu dong cap nhat)
//| Block +-35 phut quanh moi su kien HIGH impact cua USD/XAU       |
//| Khong can hardcode gio co dinh - lay tu lich nen tang MT5        |
//+------------------------------------------------------------------+
bool FilterNews()
{
    datetime now      = TimeGMT();
    datetime fromTime = now - 2100; // 35 phut truoc
    datetime toTime   = now + 2100; // 35 phut sau

    MqlCalendarValue values[];
    // Lay tat ca su kien USD trong cua so +-35 phut
    int count = CalendarValueHistory(values, fromTime, toTime, "US");

    for(int i = 0; i < count; i++)
    {
        MqlCalendarEvent ev;
        if(!CalendarEventById(values[i].event_id, ev)) continue;

        // Chi block tin HIGH impact (NFP, CPI, FOMC, GDP, etc.)
        if(ev.importance == CALENDAR_IMPORTANCE_HIGH)
        {
            LogThrottled("NEWS_CAL",
                StringFormat("[NEWS] High-impact USD event: \"%s\" luc %s -> Dung GD",
                    ev.name,
                    TimeToString(values[i].time, TIME_DATE|TIME_MINUTES)),
                300);
            return false;
        }
    }

    // Kiem tra them vang (XAU) neu broker co calendar cho commodity
    int countXau = CalendarValueHistory(values, fromTime, toTime, "XAU");
    for(int i = 0; i < countXau; i++)
    {
        MqlCalendarEvent ev;
        if(!CalendarEventById(values[i].event_id, ev)) continue;
        if(ev.importance == CALENDAR_IMPORTANCE_HIGH)
        {
            LogThrottled("NEWS_XAU",
                StringFormat("[NEWS] High-impact XAU event: \"%s\" -> Dung GD", ev.name), 300);
            return false;
        }
    }

    return true;
}


//+------------------------------------------------------------------+
//| PHÂN TÍCH H4: Xác định xu hướng chính                           |
//| Logic: Giá đóng cửa H4 > EMA21 AND EMA21 đang dốc lên -> Buy   |
//+------------------------------------------------------------------+
//| BO LOC D1: Xu huong khung ngay - lop loc cao nhat               |
//| Logic: Gia dong cua D1 > EMA21 AND EMA21 dang tang -> Chi Buy   |
//|        Gia dong cua D1 < EMA21 AND EMA21 dang giam -> Chi Sell  |
//| Muc dich: Tranh giao dich nguoc xu huong chinh (D1 filter)      |
//| Tra ve: 1=Bull, -1=Bear, 0=Khong xac dinh                       |
//+------------------------------------------------------------------+
int GetD1Filter()
{
    double ema21[];
    ArraySetAsSeries(ema21, true);

    // Lay 5 bars D1 da dong (tranh bar dang hinh thanh)
    if(CopyBuffer(g_d1EMA21Handle, 0, 1, 5, ema21) <= 0)
    {
        Print("[LOI] Khong doc duoc EMA21 D1: ", GetLastError());
        return 0;
    }

    double d1Close[];
    ArraySetAsSeries(d1Close, true);
    if(CopyClose(Symbol(), PERIOD_D1, 1, 3, d1Close) <= 0) return 0;

    double lastClose = d1Close[0];
    double lastEMA   = ema21[0];

    // Slope D1: so sanh EMA21 hien tai vs 3 bars truoc (xu huong D1 phai ro rang)
    bool rising  = (ema21[0] > ema21[3]);
    bool falling = (ema21[0] < ema21[3]);

    if(lastClose > lastEMA && rising)
    {
        LogThrottled("D1_BULL",
            StringFormat("[D1] BUY | Close=%.2f > EMA21=%.2f | D1 slope up", lastClose, lastEMA),
            3600);
        return 1;
    }
    if(lastClose < lastEMA && falling)
    {
        LogThrottled("D1_BEAR",
            StringFormat("[D1] SELL | Close=%.2f < EMA21=%.2f | D1 slope down", lastClose, lastEMA),
            3600);
        return -1;
    }

    LogThrottled("D1_FLAT",
        StringFormat("[D1] Xu huong khong ro | Close=%.2f EMA21=%.2f slope:(%.2f->%.2f)",
            lastClose, lastEMA, ema21[3], ema21[0]),
        3600);
    return 0;
}

//| Gia dong cua H4 < EMA21 AND EMA21 dang doc xuong -> Sell        |
//| Yeu cau EMA21 co slope ro rang de tranh thi truong ngang        |
//| Tra ve: 1=Bullish, -1=Bearish, 0=Khong xac dinh                 |
//+------------------------------------------------------------------+
int GetH4Trend()
{
    double ema21[];
    ArraySetAsSeries(ema21, true);

    // Lấy 4 bars để kiểm tra slope EMA21 H4
    if(CopyBuffer(g_h4EMA21Handle, 0, 1, 4, ema21) <= 0)
    {
        Print("[LỖI] Không đọc được EMA21 H4: ", GetLastError());
        return 0;
    }

    double h4Close[];
    ArraySetAsSeries(h4Close, true);
    if(CopyClose(Symbol(), PERIOD_H4, 1, 3, h4Close) <= 0)
    {
        Print("[LỖI] Không đọc được giá đóng H4: ", GetLastError());
        return 0;
    }

    double lastClose = h4Close[0]; // Nến H4 đã đóng gần nhất
    double lastEMA21 = ema21[0];

    // Kiểm tra slope EMA21 H4: EMA21 hiện tại phải cao hơn/thấp hơn 2 bars trước
    // Dùng 2 bars để tránh noise 1 bar
    bool ema21Rising  = (ema21[0] > ema21[2]); // EMA21 đang dốc lên
    bool ema21Falling = (ema21[0] < ema21[2]); // EMA21 đang dốc xuống

    // BUY: giá trên EMA21 VÀ EMA21 đang dốc lên (xu hướng tăng thực sự)
    if(lastClose > lastEMA21 && ema21Rising)
    {
        LogThrottled("H4_BULL",
            StringFormat("[H4] BUY | Đóng=%.2f > EMA21=%.2f | EMA21 slope^ (%.2f->%.2f)",
                lastClose, lastEMA21, ema21[2], ema21[0]),
            3600);
        return 1;
    }

    // SELL: giá dưới EMA21 VÀ EMA21 đang dốc xuống (xu hướng giảm thực sự)
    if(lastClose < lastEMA21 && ema21Falling)
    {
        LogThrottled("H4_BEAR",
            StringFormat("[H4] SELL | Đóng=%.2f < EMA21=%.2f | EMA21 slopev (%.2f->%.2f)",
                lastClose, lastEMA21, ema21[2], ema21[0]),
            3600);
        return -1;
    }

    // Không đủ điều kiện: giá và slope mâu thuẫn (thị trường ngang/đảo chiều)
    LogThrottled("H4_FLAT",
        StringFormat("[H4] Xu hướng không rõ | Đóng=%.2f EMA21=%.2f slope:(%.2f->%.2f)",
            lastClose, lastEMA21, ema21[2], ema21[0]),
        3600);
    return 0;
}

//+------------------------------------------------------------------+
//| PHÂN TÍCH H1: EMA crossover + ADX + DI direction filter         |
//| Logic:                                                            |
//|  - EMA8 cắt EMA21 trong 2 bars H1 gần nhất (tín hiệu còn mới)  |
//|  - ADX > InpADXMin (xu hướng đủ mạnh)                           |
//|  - ADX <= InpADXMax (không kiệt sức)                             |
//|  - +DI > -DI cho Buy | -DI > +DI cho Sell (định hướng momentum) |
//| Trả về: 1=Buy signal, -1=Sell signal, 0=Không tín hiệu          |
//+------------------------------------------------------------------+
int GetH1Signal()
{
    // Lay 8 bars H1 da dong (can du de kiem tra sustained alignment)
    double emaFast[], emaSlow[];
    ArraySetAsSeries(emaFast, true);
    ArraySetAsSeries(emaSlow, true);

    if(CopyBuffer(g_h1EMAFastHandle, 0, 1, 8, emaFast) <= 0 ||
       CopyBuffer(g_h1EMASlowHandle, 0, 1, 8, emaSlow) <= 0)
    {
        Print("[LOI] Khong doc duoc EMA H1: ", GetLastError());
        return 0;
    }

    // ADX: buffer 0=ADX chinh, buffer 1=+DI, buffer 2=-DI
    double adxMain[], plusDI[], minusDI[];
    ArraySetAsSeries(adxMain,  true);
    ArraySetAsSeries(plusDI,   true);
    ArraySetAsSeries(minusDI,  true);

    if(CopyBuffer(g_h1ADXHandle, 0, 1, 3, adxMain)  <= 0 ||
       CopyBuffer(g_h1ADXHandle, 1, 1, 3, plusDI)   <= 0 ||
       CopyBuffer(g_h1ADXHandle, 2, 1, 3, minusDI)  <= 0)
    {
        Print("[LOI] Khong doc duoc ADX/DI H1: ", GetLastError());
        return 0;
    }

    double adxVal  = adxMain[0];
    double plusVal = plusDI[0];
    double minVal  = minusDI[0];

    // --- Kiem tra nguong ADX ---
    if(adxVal <= InpADXMin)
    {
        LogThrottled("ADX_LOW",
            StringFormat("[H1 ADX] %.1f <= %.0f -> Di ngang, bo qua", adxVal, InpADXMin), 900);
        return 0;
    }
    if(adxVal > InpADXMax)
    {
        LogThrottled("ADX_HIGH",
            StringFormat("[H1 ADX] %.1f > %.0f -> Kiet suc, bo qua", adxVal, InpADXMax), 900);
        return 0;
    }

    // --- DI direction: +DI phai lon hon -DI it nhat 3 don vi ---
    // Nguong 3 tranh truong hop +DI va -DI gap nhau (khong ro chieu)
    bool bullMomentum = (plusVal > minVal + 3.0);
    bool bearMomentum = (minVal  > plusVal + 3.0);

    if(!bullMomentum && !bearMomentum)
    {
        LogThrottled("DI_WEAK",
            StringFormat("[H1 DI] Chieu khong ro: +DI=%.1f -DI=%.1f (can chenh lech >3)", plusVal, minVal),
            900);
        return 0;
    }

    // --- SUSTAINED EMA ALIGNMENT: EMA8 phai duy tri tren/duoi EMA21 it nhat 5/8 bars ---
    // Day la thay doi chinh: KHONG dung EMA cross (lagging, bat dao chieu)
    // Thay vao do, yeu cau EMA8 DA DUOC tren EMA21 nhieu bars = xu huong on dinh
    int bullBars = 0; // So bars EMA8 > EMA21
    int bearBars = 0; // So bars EMA8 < EMA21

    for(int i = 0; i < 8; i++)
    {
        if(emaFast[i] > emaSlow[i]) bullBars++;
        if(emaFast[i] < emaSlow[i]) bearBars++;
    }

    // Yeu cau: it nhat 5/8 bars phai cung chieu (khong phai cross moi = trend on dinh)
    // Va EMA8 hien tai van phai o dung chieu
    bool sustainedBull = (bullBars >= 5 && emaFast[0] > emaSlow[0]);
    bool sustainedBear = (bearBars >= 5 && emaFast[0] < emaSlow[0]);

    if(!sustainedBull && !bearMomentum && !sustainedBear && !bullMomentum)
    {
        LogThrottled("H1_NOALIGN",
            StringFormat("[H1] EMA chua on dinh | bull=%d/8 bear=%d/8 bars", bullBars, bearBars),
            900);
        return 0;
    }

    // --- EMA gap: EMA8 phai cach EMA21 it nhat 0.05%% gia (tranh giao nhau lien tuc) ---
    double gapPct = MathAbs(emaFast[0] - emaSlow[0]) / emaSlow[0] * 100.0;
    if(gapPct < 0.05)
    {
        LogThrottled("H1_NOGAP",
            StringFormat("[H1] EMA gap qua nho: %.3f%% < 0.05%% -> EMA8 EMA21 sat nhau", gapPct),
            900);
        return 0;
    }

    // --- Ket hop: sustained alignment + DI cung chieu ---
    if(sustainedBull && bullMomentum)
    {
        Print(StringFormat("[H1] BUY | EMA%d>EMA%d (%d/8 bars) gap=%.3f%% | ADX=%.1f +DI=%.1f -DI=%.1f",
            InpEMAFast, InpEMASlow, bullBars, gapPct, adxVal, plusVal, minVal));
        return 1;
    }
    if(sustainedBear && bearMomentum)
    {
        Print(StringFormat("[H1] SELL | EMA%d<EMA%d (%d/8 bars) gap=%.3f%% | ADX=%.1f +DI=%.1f -DI=%.1f",
            InpEMAFast, InpEMASlow, bearBars, gapPct, adxVal, plusVal, minVal));
        return -1;
    }

    LogThrottled("H1_NOCONF",
        StringFormat("[H1] EMA va DI khong dong thuan | bull=%d/8 bear=%d/8 +DI=%.1f -DI=%.1f",
            bullBars, bearBars, plusVal, minVal),
        900);
    return 0;
}

//+------------------------------------------------------------------+
//| KIỂM TRA PULLBACK VỀ EMA21 H1                                   |
//| Logic: Trong 10 bar H1 gần nhất, Low(Buy)/High(Sell)            |
//|        phải đã chạm hoặc xuyên qua EMA21 H1                     |
//+------------------------------------------------------------------+
bool CheckPullbackToEMA21H1(int direction)
{
    // Pullback phai xay ra trong 4 bar H1 gan nhat (khong chase gia cu)
    const int BARS = 4;

    double ema21[];
    ArraySetAsSeries(ema21, true);
    // Doc them 1 bar hien tai (bar 0) de kiem tra gia hien tai
    if(CopyBuffer(g_h1EMASlowHandle, 0, 0, BARS + 1, ema21) <= 0) return false;

    double h1High[], h1Low[], h1Close[];
    ArraySetAsSeries(h1High,  true);
    ArraySetAsSeries(h1Low,   true);
    ArraySetAsSeries(h1Close, true);
    if(CopyHigh (Symbol(), PERIOD_H1, 1, BARS, h1High)  <= 0) return false;
    if(CopyLow  (Symbol(), PERIOD_H1, 1, BARS, h1Low)   <= 0) return false;
    if(CopyClose(Symbol(), PERIOD_H1, 1, BARS, h1Close) <= 0) return false;

    bool pullbackFound = false;
    int  pbBar         = -1;

    for(int i = 0; i < BARS; i++)
    {
        double ema = ema21[i + 1]; // bar i da dong tuong ung ema21[i+1] (0=hien tai)
        double tol = ema * 0.0015; // 0.15% tolerance (~$3 tai XAUUSD $2000)

        if(direction == 1) // Buy: Low phai cham EMA21
        {
            if(h1Low[i] <= ema + tol)
            {
                pullbackFound = true;
                pbBar = i;
                break;
            }
        }
        else // Sell: High phai cham EMA21
        {
            if(h1High[i] >= ema - tol)
            {
                pullbackFound = true;
                pbBar = i;
                break;
            }
        }
    }

    if(!pullbackFound)
    {
        double curPrice = (direction == 1) ? SymbolInfoDouble(Symbol(), SYMBOL_BID)
                                           : SymbolInfoDouble(Symbol(), SYMBOL_ASK);
        double distPct  = MathAbs(curPrice - ema21[0]) / ema21[0] * 100.0;
        LogThrottled("NO_PULLBACK",
            StringFormat("[PULLBACK] Chua pullback ve EMA21 H1 trong %d bar. Khoang cach: %.2f%%",
                BARS, distPct),
            900);
        return false;
    }

    // Xac nhan bounce: gia hien tai phai da quay ve dung phia EMA21
    // (tranh vao lenh khi gia dang cat xuong EMA21 ma chua bounce)
    double curBid = SymbolInfoDouble(Symbol(), SYMBOL_BID);
    double curEMA = ema21[0]; // EMA21 cua bar H1 dang hinh thanh

    if(direction == 1 && curBid < curEMA - curEMA * 0.001)
    {
        LogThrottled("PB_NOTBOUNCED",
            StringFormat("[PULLBACK] Gia hien tai %.2f chua bounce ve tren EMA21=%.2f -> Bo qua", curBid, curEMA),
            600);
        return false;
    }
    if(direction == -1 && curBid > curEMA + curEMA * 0.001)
    {
        LogThrottled("PB_NOTBOUNCED",
            StringFormat("[PULLBACK] Gia hien tai %.2f chua bounce ve duoi EMA21=%.2f -> Bo qua", curBid, curEMA),
            600);
        return false;
    }

    Print(StringFormat("[PULLBACK] OK Bar H1 -%d cham EMA21 va bounce ve %.2f | EMA21=%.2f",
        pbBar + 1, curBid, curEMA));
    return true;
}

//+------------------------------------------------------------------+
//| XÁC NHẬN XU HƯỚNG M15                                           |
//| Logic: Giá đóng cửa M15 phải cùng phía EMA21 M15 như H4         |
//+------------------------------------------------------------------+
bool ConfirmM15Trend(int direction)
{
    // Doc 4 bar de kiem tra slope EMA21 M15
    double ema21[];
    ArraySetAsSeries(ema21, true);
    if(CopyBuffer(g_m15EMA21Handle, 0, 1, 4, ema21) <= 0)
    {
        Print("[LOI] Khong doc duoc EMA21 M15: ", GetLastError());
        return false;
    }

    double m15Close[], m15Open[];
    ArraySetAsSeries(m15Close, true);
    ArraySetAsSeries(m15Open,  true);
    if(CopyClose(Symbol(), PERIOD_M15, 1, 3, m15Close) <= 0) return false;
    if(CopyOpen (Symbol(), PERIOD_M15, 1, 3, m15Open)  <= 0) return false;

    double lastClose = m15Close[0];
    double lastEMA   = ema21[0];

    // Kiem tra 1: Gia dong cua M15 phai dung phia EMA21
    bool priceOK = (direction == 1) ? (lastClose > lastEMA)
                                    : (lastClose < lastEMA);
    if(!priceOK)
    {
        LogThrottled("M15_PRICE",
            StringFormat("[M15] Gia dong cua %.2f khong cung phia EMA21=%.2f", lastClose, lastEMA),
            600);
        return false;
    }

    // Kiem tra 2: EMA21 M15 phai co slope dung chieu
    // So sanh EMA21 hien tai voi 3 bar truoc (tranh M15 di ngang)
    bool slopeOK = (direction == 1) ? (ema21[0] > ema21[3])
                                    : (ema21[0] < ema21[3]);
    if(!slopeOK)
    {
        LogThrottled("M15_SLOPE",
            StringFormat("[M15] EMA21 slope khong hop le: %.2f -> %.2f", ema21[3], ema21[0]),
            600);
        return false;
    }

    // Kiem tra 3: Than nen M15 vua dong phai co do lon toi thieu (tranh doji)
    double body     = MathAbs(m15Close[0] - m15Open[0]);
    double minBody  = SymbolInfoDouble(Symbol(), SYMBOL_POINT) * 10; // toi thieu 10 points
    if(body < minBody)
    {
        LogThrottled("M15_DOJI",
            StringFormat("[M15] Nen doji (body=%.3f < %.3f) -> Bo qua", body, minBody),
            600);
        return false;
    }

    Print(StringFormat("[M15] OK %s | Dong=%.2f %s EMA21=%.2f | Slope: %.2f->%.2f | Body=%.3f",
        DirToStr(direction), lastClose,
        (direction==1 ? ">" : "<"), lastEMA,
        ema21[3], ema21[0], body));
    return true;
}

//+------------------------------------------------------------------+
//| XÁC NHẬN NẾN M5 ĐÓNG CỬA CÙNG CHIỀU                            |
//| Logic: 2 nến M5 liên tiếp vừa đóng phải cùng chiều (momentum)  |
//|        Loại bỏ nến doji (thân nến quá nhỏ)                      |
//| Yêu cầu 2 nến liên tiếp để lọc false signal 1 nến đơn          |
//+------------------------------------------------------------------+
bool ConfirmM5ClosedCandle(int direction)
{
    double m5Open[], m5Close[];
    ArraySetAsSeries(m5Open, true);
    ArraySetAsSeries(m5Close, true);

    // Lấy 2 nến M5 đã đóng gần nhất (bar 1 và bar 2)
    if(CopyOpen (Symbol(), PERIOD_M5, 1, 2, m5Open)  <= 0) return false;
    if(CopyClose(Symbol(), PERIOD_M5, 1, 2, m5Close) <= 0) return false;

    // Nến 1 = bar vừa đóng (index 0), Nến 2 = bar trước đó (index 1)
    double body1 = MathAbs(m5Close[0] - m5Open[0]);
    double body2 = MathAbs(m5Close[1] - m5Open[1]);

    // Yêu cầu thân nến tối thiểu 5 points mỗi nến (tránh doji)
    double minBody = SymbolInfoDouble(Symbol(), SYMBOL_POINT) * 5;

    if(body1 < minBody)
    {
        Print(StringFormat("[M5] Nến 1 doji (body=%.3f < %.3f) -> Bỏ qua", body1, minBody));
        return false;
    }
    if(body2 < minBody)
    {
        Print(StringFormat("[M5] Nến 2 doji (body=%.3f < %.3f) -> Bỏ qua", body2, minBody));
        return false;
    }

    bool bull1 = (m5Close[0] > m5Open[0]);
    bool bull2 = (m5Close[1] > m5Open[1]);
    bool bear1 = (m5Close[0] < m5Open[0]);
    bool bear2 = (m5Close[1] < m5Open[1]);

    // Buy: cả 2 nến liên tiếp phải là nến tăng
    if(direction == 1 && bull1 && bull2)
    {
        Print(StringFormat("[M5] Xác nhận BUY | 2 nến tăng: C1=%.2f C2=%.2f",
            m5Close[0], m5Close[1]));
        return true;
    }
    // Sell: cả 2 nến liên tiếp phải là nến giảm
    if(direction == -1 && bear1 && bear2)
    {
        Print(StringFormat("[M5] Xác nhận SELL | 2 nến giảm: C1=%.2f C2=%.2f",
            m5Close[0], m5Close[1]));
        return true;
    }

    Print(StringFormat("[M5] 2 nến không cùng chiều %s -> Bỏ qua", DirToStr(direction)));
    return false;
}


//+------------------------------------------------------------------+
//| TÍNH TOÁN SL / TP                                                |
//| SL = Swing Low/High M5 gần nhất + ATR buffer                    |
//| TP1 = Entry + SL_distance × 2 (RR 1:2)                          |
//| TP2 = Entry + SL_distance × 3 (RR 1:3)                          |
//| Trả về false nếu SL vượt ngưỡng InpMaxSLGia                     |
//+------------------------------------------------------------------+
bool CalculateSLTP(int  direction,
                   double &entry,
                   double &sl,
                   double &tp1,
                   double &tp2)
{
    int    digits = (int)SymbolInfoInteger(Symbol(), SYMBOL_DIGITS);
    double point  = SymbolInfoDouble(Symbol(), SYMBOL_POINT);

    // --- Giá entry ---
    entry = (direction == 1) ? SymbolInfoDouble(Symbol(), SYMBOL_ASK)
                             : SymbolInfoDouble(Symbol(), SYMBOL_BID);

    // --- ATR M5 (buffer đầu tiên = ATR chính) ---
    double atrBuf[];
    ArraySetAsSeries(atrBuf, true);
    if(CopyBuffer(g_m5ATRHandle, 0, 1, 5, atrBuf) <= 0)
    {
        Print("[LỖI] Không đọc được ATR M5: ", GetLastError());
        return false;
    }
    double atrVal = atrBuf[0]; // ATR cua bar M5 da dong gan nhat

    // --- Tim Swing Low/High tren M15 (co y nghia cau truc hon M5) ---
    // M15 swing (20 bar = 5 gio) cho muc SL co y nghia cau truc thuc su
    // Sau do them buffer ATR M5 de tranh noise / spike qua SL
    const int SWING_BARS = 20;
    double m15High[], m15Low[];
    ArraySetAsSeries(m15High, true);
    ArraySetAsSeries(m15Low, true);

    if(CopyHigh(Symbol(), PERIOD_M15, 1, SWING_BARS, m15High) <= 0) return false;
    if(CopyLow (Symbol(), PERIOD_M15, 1, SWING_BARS, m15Low)  <= 0) return false;

    double structLevel = 0.0;
    bool   swingFound  = false;

    if(direction == 1) // Buy -> tim Swing Low tren M15
    {
        // Swing Low: bar [i] co Low thap hon ca [i-1] va [i+1]
        for(int i = 1; i < SWING_BARS - 1; i++)
        {
            if(m15Low[i] < m15Low[i-1] && m15Low[i] < m15Low[i+1])
            {
                structLevel = m15Low[i];
                swingFound  = true;
                Print(StringFormat("[SL] M15 Swing Low bar-%d = %.2f", i+1, structLevel));
                break;
            }
        }
        if(!swingFound)
        {
            structLevel = m15Low[ArrayMinimum(m15Low, 0, SWING_BARS)];
            Print(StringFormat("[SL] M15 Lowest Low (20 bar) = %.2f", structLevel));
        }
        sl = structLevel - atrVal * 1.0; // Buffer nho hon (1.0xATR) vi M15 swing da ro rang hon M5
    }
    else // Sell -> tim Swing High tren M15
    {
        for(int i = 1; i < SWING_BARS - 1; i++)
        {
            if(m15High[i] > m15High[i-1] && m15High[i] > m15High[i+1])
            {
                structLevel = m15High[i];
                swingFound  = true;
                Print(StringFormat("[SL] M15 Swing High bar-%d = %.2f", i+1, structLevel));
                break;
            }
        }
        if(!swingFound)
        {
            structLevel = m15High[ArrayMaximum(m15High, 0, SWING_BARS)];
            Print(StringFormat("[SL] M15 Highest High (20 bar) = %.2f", structLevel));
        }
        sl = structLevel + atrVal * 1.0;
    }

    sl = NormalizeDouble(sl, digits);

    // --- Kiểm tra khoảng cách SL ---
    // 1 giá = 1.0 price unit (XAUUSD: 1200->1210 = 10 giá)
    double slDist = MathAbs(entry - sl); // Khoảng cách tính bằng giá

    Print(StringFormat("[PLAN] %s | Entry=%.2f | Structure=%.2f | ATR=%.3f | SL=%.2f | SL_dist=%.2f giá ($%.2f)",
        DirToStr(direction), entry, structLevel, atrVal, sl, slDist, slDist));

    if(slDist > InpMaxSLGia)
    {
        Print(StringFormat("[LỌC] SL quá xa: %.2f giá > max %.0f giá -> Bỏ qua lệnh",
            slDist, InpMaxSLGia));
        return false;
    }

    if(slDist < point * 5) // SL quá nhỏ (< 5 points) -> bất thường
    {
        Print(StringFormat("[LỌC] SL quá nhỏ: %.4f -> Bỏ qua lệnh", slDist));
        return false;
    }

    // --- Tính TP1 và TP2 ---
    if(direction == 1)
    {
        tp1 = entry + slDist * 2.0; // RR 1:2
        tp2 = entry + slDist * 3.0; // RR 1:3
    }
    else
    {
        tp1 = entry - slDist * 2.0;
        tp2 = entry - slDist * 3.0;
    }
    tp1 = NormalizeDouble(tp1, digits);
    tp2 = NormalizeDouble(tp2, digits);

    Print(StringFormat("[PLAN] TP1=%.2f (RR 1:2) | TP2=%.2f (RR 1:3)", tp1, tp2));
    return true;
}

//+------------------------------------------------------------------+
//| MỞ LỆNH 1                                                        |
//| Volume: InpVolume1 lot                                           |
//| TP đặt vào lệnh = TP2; TP1 được quản lý qua trailing stop       |
//+------------------------------------------------------------------+
bool PlaceOrder1(int direction, double sl, double tp1, double tp2)
{
    MqlTradeRequest req = {};
    MqlTradeResult  res = {};

    req.action       = TRADE_ACTION_DEAL;
    req.symbol       = Symbol();
    req.volume       = InpVolume1;
    req.sl           = sl;
    req.tp           = tp2;              // TP2 đặt thẳng vào lệnh
    req.magic        = InpMagicNumber;
    req.comment      = "XAUUSD_L1_EA";  // "L1" dùng để nhận biết trong SyncPositionState
    req.deviation    = InpSlippage;
    req.type_filling = GetFillType();

    if(direction == 1)
    {
        req.type  = ORDER_TYPE_BUY;
        req.price = SymbolInfoDouble(Symbol(), SYMBOL_ASK);
    }
    else
    {
        req.type  = ORDER_TYPE_SELL;
        req.price = SymbolInfoDouble(Symbol(), SYMBOL_BID);
    }

    if(!OrderSendRetry(req, res))
    {
        Print(StringFormat("[LOI MO L1] Retcode=%d | %s", res.retcode, res.comment));
        return false;
    }

    // --- Luu trang thai lenh ---
    g_hasOrder1        = true;
    g_tradeDir         = direction;
    g_entry1           = (res.price > 0) ? res.price : req.price;
    g_sl               = sl;
    g_tp1              = tp1;
    g_tp2              = tp2;
    g_tp1Reached       = false;
    g_order2EverOpened = false;
    g_ticket1          = res.deal;
    g_tradeOpenTime    = TimeCurrent();
    g_dailyTradeCount++;
    SaveStateToGV(); // Luu ngay sau khi mo lenh thanh cong

    Print("+=========== LỆNH 1 MỞ THÀNH CÔNG ===========+");
    Print(StringFormat("| Chiều  : %-38s |", DirToStr(direction)));
    Print(StringFormat("| Entry  : %-38.2f |", g_entry1));
    Print(StringFormat("| SL     : %-38.2f |", sl));
    Print(StringFormat("| TP1    : %-33.2f (1:2) |", tp1));
    Print(StringFormat("| TP2    : %-33.2f (1:3) |", tp2));
    Print(StringFormat("| Volume : %-35.2f lot |", InpVolume1));
    Print(StringFormat("| Lệnh hôm nay: %d / %d                          |",
        g_dailyTradeCount, InpMaxDailyTrades));
    Print("+==============================================+");
    return true;
}

//+------------------------------------------------------------------+
//| MO LENH 2 (DCA - Chi mo 1 lan duy nhat)                        |
//| SL = giong lenh 1 (chia se cung SL)                            |
//| TP = RR 1:1 tu entry L2 (khong phai breakeven L1)              |
//| Volume = InpVolume1 (bang L1, tranh risk lech)                  |
//| Bo loc RSI: chi mo khi gia da qua ban/qua mua tren M5           |
//+------------------------------------------------------------------+
void PlaceOrder2()
{
    if(g_order2EverOpened)
    {
        Print("[L2] Da mo lan nay, khong mo lai.");
        return;
    }

    if(g_dailyTradeCount >= InpMaxDailyTrades)
    {
        Print(StringFormat("[L2] Khong mo: da dat gioi han %d lenh/ngay", InpMaxDailyTrades));
        return;
    }

    // --- Bo loc RSI: tranh averaging vao momentum qua manh ---
    if(!CheckRSIforL2())
    {
        Print("[L2] RSI khong hop le, bo qua mo L2");
        return;
    }

    int    digits = (int)SymbolInfoInteger(Symbol(), SYMBOL_DIGITS);
    double point  = SymbolInfoDouble(Symbol(), SYMBOL_POINT);

    // Lay gia entry L2 hien tai
    double l2Entry = (g_tradeDir == 1) ? SymbolInfoDouble(Symbol(), SYMBOL_ASK)
                                       : SymbolInfoDouble(Symbol(), SYMBOL_BID);

    // Tinh SL distance cua L2 (tu entry L2 toi SL chung)
    double l2SlDist = MathAbs(l2Entry - g_sl);
    if(l2SlDist < point * 5)
    {
        Print(StringFormat("[L2] SL distance qua nho (%.4f) -> Bo qua", l2SlDist));
        return;
    }

    // TP L2 = RR 1:1 tu entry L2 (khong phai breakeven L1)
    // Vi du: L1 entry=2000 SL=1990, L2 triggered tai 1993 -> L2 SL=1990 dist=3 -> L2 TP=1993+3=1996
    double l2TP;
    if(g_tradeDir == 1)
        l2TP = NormalizeDouble(l2Entry + l2SlDist * 1.0, digits); // Buy: TP phia tren
    else
        l2TP = NormalizeDouble(l2Entry - l2SlDist * 1.0, digits); // Sell: TP phia duoi

    MqlTradeRequest req = {};
    MqlTradeResult  res = {};

    req.action       = TRADE_ACTION_DEAL;
    req.symbol       = Symbol();
    req.volume       = InpVolume1;  // Bang L1, tranh risk lech
    req.sl           = g_sl;        // Chia se SL chung voi L1
    req.tp           = l2TP;        // TP theo RR 1:1 tu entry L2
    req.magic        = InpMagicNumber;
    req.comment      = "XAUUSD_L2_EA";
    req.deviation    = InpSlippage;
    req.type_filling = GetFillType();

    if(g_tradeDir == 1)
    {
        req.type  = ORDER_TYPE_BUY;
        req.price = l2Entry;
    }
    else
    {
        req.type  = ORDER_TYPE_SELL;
        req.price = l2Entry;
    }

    if(!OrderSendRetry(req, res))
    {
        Print(StringFormat("[LOI MO L2] Retcode=%d | %s", res.retcode, res.comment));
        return;
    }

    g_hasOrder2        = true;
    g_order2EverOpened = true;
    g_ticket2          = res.deal;
    g_entry2           = l2Entry;
    g_dailyTradeCount++;
    SaveStateToGV();

    Print("+=========== LENH 2 MO THANH CONG ===========+");
    PrintFormat("| Chieu  : %-38s |", DirToStr(g_tradeDir));
    PrintFormat("| Entry  : %-38.2f |", l2Entry);
    PrintFormat("| SL     : %-30.2f (= SL lenh 1) |", g_sl);
    PrintFormat("| TP     : %-28.2f (RR 1:1 tu L2) |", l2TP);
    PrintFormat("| SL dist: %-35.2f |", l2SlDist);
    PrintFormat("| Volume : %-35.2f lot |", InpVolume1);
    Print("+==============================================+");
}


//+------------------------------------------------------------------+
//| QUẢN LÝ LỆNH ĐANG MỞ - Dispatcher                               |
//| Gọi mỗi tick khi có lệnh đang mở                                |
//+------------------------------------------------------------------+
void ManageOpenPositions()
{
    // Giá hiện tại: Bid để kiểm tra Buy P&L, Ask để kiểm tra Sell P&L
    double curPrice = (g_tradeDir == 1) ? SymbolInfoDouble(Symbol(), SYMBOL_BID)
                                        : SymbolInfoDouble(Symbol(), SYMBOL_ASK);
    double slDist   = MathAbs(g_entry1 - g_sl); // Khoảng cách SL tính bằng giá

    // --- TIME-BASED EXIT: Tu dong dong neu qua X bars H1 ma chua dat TP1 ---
    // Lenh ket ma qua lau ma khong chuyen bien = sai chieu, nen cat lo som
    if(InpMaxHoldBarsH1 > 0 && !g_tp1Reached && g_tradeOpenTime > 0)
    {
        int secondsPerBar = PeriodSeconds(PERIOD_H1);
        datetime expireTime = g_tradeOpenTime + (datetime)(InpMaxHoldBarsH1 * secondsPerBar);
        if(TimeCurrent() >= expireTime)
        {
            CloseAllPositions(StringFormat("Het han %d bars H1 chua dat TP1", InpMaxHoldBarsH1));
            return;
        }
    }

    if(g_hasOrder1 && g_hasOrder2)
    {
        // Có 2 lệnh: ưu tiên xử lý cơ chế 2 lệnh
        ManageTwoOrders(curPrice);
    }
    else if(g_hasOrder1)
    {
        // Chỉ có lệnh 1: trailing stop
        ManageSingleOrderTrailing(curPrice);

        // Kiểm tra điều kiện mở lệnh 2 (chỉ nếu chưa từng mở)
        if(!g_order2EverOpened)
            CheckAndTriggerOrder2(curPrice, slDist);
    }
    // Nếu chỉ còn lệnh 2 (lệnh 1 đã đóng vì lý do nào đó): không can thiệp,
    // để lệnh 2 tự đóng qua TP/SL
}

//+------------------------------------------------------------------+
//| TRAILING STOP KHI CHỈ CÓ 1 LỆNH                                |
//|                                                                   |
//| Giai đoạn 1 (chưa đạt TP1):                                     |
//|   -> Chờ giá chạm TP1, sau đó dời SL về Entry+1 giá             |
//|                                                                   |
//| Giai đoạn 2 (đã đạt TP1):                                       |
//|   -> Khi giá đạt 50% khoảng TP1->TP2: dời SL lên TP1             |
//|   -> Để lệnh chạy tự do đến TP2                                  |
//+------------------------------------------------------------------+
void ManageSingleOrderTrailing(double curPrice)
{
    if(g_ticket1 == 0 || !PositionSelectByTicket(g_ticket1)) return;

    double curSL  = PositionGetDouble(POSITION_SL);
    int    digits = (int)SymbolInfoInteger(Symbol(), SYMBOL_DIGITS);

    if(!g_tp1Reached)
    {
        // --- Giai doan 1: Cho TP1 ---
        bool hitTP1 = (g_tradeDir == 1) ? (curPrice >= g_tp1)
                                        : (curPrice <= g_tp1);
        if(hitTP1)
        {
            g_tp1Reached = true;

            // PARTIAL CLOSE: Neu InpPartialCloseTP1=true, dong 50%% khoi luong L1
            // Muc dich: Lock in loi nhuan RR 1:2 tren phan lon khi thi truong chua du manh chay den TP2
            if(InpPartialCloseTP1)
            {
                double halfVol = NormalizeDouble(InpVolume1 * 0.5, 2);
                double lotStep = SymbolInfoDouble(Symbol(), SYMBOL_VOLUME_STEP);
                double minLot  = SymbolInfoDouble(Symbol(), SYMBOL_VOLUME_MIN);
                halfVol = MathFloor(halfVol / lotStep) * lotStep;

                if(halfVol >= minLot)
                {
                    Print(StringFormat("[TRAILING] TP1 dat (%.2f) -> Dong 50%% = %.2f lot",
                        g_tp1, halfVol));
                    ClosePartialPosition(g_ticket1, halfVol);
                }
                else
                {
                    // Khoi luong qua nho de dong 1 nua -> dong toan bo
                    Print(StringFormat("[TRAILING] TP1 dat, khoi luong nho -> Dong het %.2f lot", InpVolume1));
                    ClosePositionByTicket(g_ticket1);
                    return;
                }
            }

            // Doi SL ve Entry + 1 gia (Buy) hoac Entry - 1 gia (Sell) de dam bao hoa von
            double newSL = (g_tradeDir == 1)
                           ? NormalizeDouble(g_entry1 + 1.0, digits)
                           : NormalizeDouble(g_entry1 - 1.0, digits);

            if(ModifyPositionSL(g_ticket1, newSL, true))
                Print(StringFormat("[TRAILING] OK TP1 dat -> SL doi ve Entry+1gia=%.2f", newSL));
        }
    }
    else
    {
        // --- Giai doan 2: ATR Trailing tu TP1 -> TP2 ---
        // Dung ATR M15 de trail SL: SL = gia hien tai - InpTrailATRMult * ATR_M15
        // Cho khong gian tho nhieu hon EMA21 M15 (tranh bi quet SL som tren XAU bien dong manh)
        double atrM15[];
        ArraySetAsSeries(atrM15, true);

        if(CopyBuffer(g_m15ATRHandle, 0, 1, 3, atrM15) > 0 && atrM15[0] > 0)
        {
            double atrTrail = atrM15[0] * InpTrailATRMult;
            double newSL;

            if(g_tradeDir == 1)
                newSL = NormalizeDouble(curPrice - atrTrail, digits); // Buy: SL phia duoi gia
            else
                newSL = NormalizeDouble(curPrice + atrTrail, digits); // Sell: SL phia tren gia

            // Dam bao SL moi tot hon SL cu (chi trail theo huong co loi)
            bool better = (g_tradeDir == 1) ? (newSL > curSL) : (newSL < curSL);

            // Dam bao SL moi khong thap hon TP1 (khong lun lui ve vung lo)
            bool aboveTP1 = (g_tradeDir == 1) ? (newSL >= g_tp1 - 0.5) : (newSL <= g_tp1 + 0.5);

            if(better && aboveTP1 && ModifyPositionSL(g_ticket1, newSL, true))
                LogThrottled("ATR_TRAIL",
                    StringFormat("[TRAILING] ATR trail: SL moi=%.2f (gia=%.2f - %.1fx ATR M15=%.3f)",
                        newSL, curPrice, InpTrailATRMult, atrM15[0]),
                    60);
        }
    }
}

//+------------------------------------------------------------------+
//| KIỂM TRA VÀ KÍCH HOẠT MỞ LỆNH 2                               |
//| Điều kiện: Giá chạy ngược chiều bằng 50% khoảng cách SL        |
//+------------------------------------------------------------------+
void CheckAndTriggerOrder2(double curPrice, double slDist)
{
    // Trigger L2 tai InpL2TriggerPct cua SL distance (mac dinh 70%)
    // Vi du: SL = 20 gia, InpL2TriggerPct=0.70 -> L2 mo khi gia di nguoc 14 gia
    double triggerDist = slDist * InpL2TriggerPct;
    bool   trigger     = false;

    if(g_tradeDir == 1  && curPrice <= g_entry1 - triggerDist) trigger = true;
    if(g_tradeDir == -1 && curPrice >= g_entry1 + triggerDist) trigger = true;

    if(trigger)
    {
        Print(StringFormat("[L2] Kich hoat! Gia=%.2f | Entry=%.2f | %.0f%%SL=%.2f gia (SL=%.2f)",
            curPrice, g_entry1, InpL2TriggerPct*100, triggerDist, g_sl));
        PlaceOrder2();
    }
}

//+------------------------------------------------------------------+
//| QUẢN LÝ KHI CÓ 2 LỆNH ĐANG MỞ                                 |
//|                                                                   |
//| Điều kiện đóng lệnh 2:                                          |
//|   Buy : giá hồi lên >= entry - 1 giá (cách entry 1 giá)         |
//|   Sell: giá hồi xuống <= entry + 1 giá                           |
//| Sau đó: dời SL lệnh 1 về entry (hòa vốn), trailing tiếp tục    |
//+------------------------------------------------------------------+
void ManageTwoOrders(double curPrice)
{
    int    digits  = (int)SymbolInfoInteger(Symbol(), SYMBOL_DIGITS);
    bool   doClose = false;

    // Dieu kien dong L2 thu cong: gia hoi ve va L2 DANG CO LOI
    // (tranh dong L2 o lo khi gia dao dong quanh entry1)
    // L2 entry thap hon entry1 (Buy) nen chi dong khi gia da qua L2 entry
    bool l2InProfit = false;
    if(g_entry2 > 0)
    {
        if(g_tradeDir == 1)  l2InProfit = (curPrice > g_entry2 + 0.5); // Buy L2: gia tren entry L2
        if(g_tradeDir == -1) l2InProfit = (curPrice < g_entry2 - 0.5); // Sell L2: gia duoi entry L2
    }
    else
    {
        // Neu khong biet entry L2 (restart), fallback: chi dong khi gia qua entry L1
        l2InProfit = (g_tradeDir == 1)  ? (curPrice >= g_entry1) : (curPrice <= g_entry1);
    }

    // Dieu kien: gia hoi ve entry1 VA L2 dang co loi
    if(g_tradeDir == 1  && curPrice >= g_entry1 - 0.5 && l2InProfit) doClose = true;
    if(g_tradeDir == -1 && curPrice <= g_entry1 + 0.5 && l2InProfit) doClose = true;

    if(doClose && g_hasOrder2 && g_ticket2 != 0)
    {
        Print(StringFormat("[2L] Gia hoi ve entry (%.2f >= entry L1 %.2f) + L2 co loi -> Dong L2",
            curPrice, g_entry1));

        if(ClosePositionByTicket(g_ticket2))
        {
            g_hasOrder2 = false;
            g_ticket2   = 0;

            // Dời SL lệnh 1 về đúng entry (hòa vốn hoàn toàn)
            double entryAsSL = NormalizeDouble(g_entry1, digits);
            if(ModifyPositionSL(g_ticket1, entryAsSL, false))
                Print(StringFormat("[TRAILING] OK SL lệnh 1 dời về entry=%.2f (hòa vốn)", g_entry1));

            // Tiếp tục cơ chế trailing 1 lệnh từ tick kế tiếp
        }
    }
    // Nếu giá chưa đủ điều kiện: giữ nguyên 2 lệnh, chờ tiếp
}

//+------------------------------------------------------------------+
//| SỬA STOP LOSS CỦA VỊ THẾ                                        |
//| onlyImprove = true: Chỉ di chuyển SL theo chiều có lợi (trailing)|
//| onlyImprove = false: Cho phép set SL bất kỳ (ví dụ về entry)   |
//+------------------------------------------------------------------+
bool ModifyPositionSL(ulong ticket, double newSL, bool onlyImprove)
{
    if(ticket == 0 || !PositionSelectByTicket(ticket)) return false;

    double curSL   = PositionGetDouble(POSITION_SL);
    double curTP   = PositionGetDouble(POSITION_TP);
    int    digits  = (int)SymbolInfoInteger(Symbol(), SYMBOL_DIGITS);
    double point   = SymbolInfoDouble(Symbol(), SYMBOL_POINT);

    newSL = NormalizeDouble(newSL, digits);

    // Kiểm tra chiều trailing (chỉ cải thiện, không lùi SL)
    if(onlyImprove && curSL > 0)
    {
        if(g_tradeDir == 1 && newSL <= curSL) return false; // Buy: không lùi SL xuống
        if(g_tradeDir == -1 && newSL >= curSL) return false; // Sell: không lùi SL lên
    }

    // Kiểm tra SYMBOL_TRADE_STOPS_LEVEL (khoảng cách tối thiểu SL với giá)
    long   stopsLvl  = SymbolInfoInteger(Symbol(), SYMBOL_TRADE_STOPS_LEVEL);
    double minDist   = stopsLvl * point;
    double bid       = SymbolInfoDouble(Symbol(), SYMBOL_BID);
    double ask       = SymbolInfoDouble(Symbol(), SYMBOL_ASK);

    if(g_tradeDir == 1 && newSL > bid - minDist)
        newSL = NormalizeDouble(bid - minDist - point, digits);
    if(g_tradeDir == -1 && newSL < ask + minDist)
        newSL = NormalizeDouble(ask + minDist + point, digits);

    MqlTradeRequest req = {};
    MqlTradeResult  res = {};

    req.action   = TRADE_ACTION_SLTP;
    req.symbol   = Symbol();
    req.position = ticket;
    req.sl       = newSL;
    req.tp       = curTP;

    if(!OrderSend(req, res))
    {
        Print(StringFormat("[LỖI MODIFY SL] ticket=%llu newSL=%.2f retcode=%d | %s",
            ticket, newSL, res.retcode, res.comment));
        return false;
    }
    return true;
}

//+------------------------------------------------------------------+
//| DONG MOT PHAN VI THE (Partial Close)                            |
//| Dung de dong 50%% L1 tai TP1 de lock profit                    |
//+------------------------------------------------------------------+
bool ClosePartialPosition(ulong ticket, double closeVol)
{
    if(ticket == 0 || !PositionSelectByTicket(ticket)) return false;

    ENUM_POSITION_TYPE posType = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
    double curVol = PositionGetDouble(POSITION_VOLUME);

    // Dam bao khong dong nhieu hon khoi luong hien tai
    if(closeVol <= 0) return false;
    if(closeVol > curVol) closeVol = curVol;

    // Lam tron theo step lot (tranh loi invalid volume)
    double lotStep = SymbolInfoDouble(Symbol(), SYMBOL_VOLUME_STEP);
    double minLot  = SymbolInfoDouble(Symbol(), SYMBOL_VOLUME_MIN);
    closeVol = MathFloor(closeVol / lotStep) * lotStep;
    if(closeVol < minLot)
    {
        Print(StringFormat("[PARTIAL] Khoi luong dong (%.2f) < min lot (%.2f) -> Dong het", closeVol, minLot));
        closeVol = curVol; // Dong het neu khong du min lot
    }
    closeVol = NormalizeDouble(closeVol, 2);

    MqlTradeRequest req = {};
    MqlTradeResult  res = {};

    req.action       = TRADE_ACTION_DEAL;
    req.symbol       = Symbol();
    req.volume       = closeVol;
    req.position     = ticket;
    req.magic        = InpMagicNumber;
    req.deviation    = InpSlippage;
    req.type_filling = GetFillType();

    if(posType == POSITION_TYPE_BUY)
    {
        req.type  = ORDER_TYPE_SELL;
        req.price = SymbolInfoDouble(Symbol(), SYMBOL_BID);
    }
    else
    {
        req.type  = ORDER_TYPE_BUY;
        req.price = SymbolInfoDouble(Symbol(), SYMBOL_ASK);
    }

    if(!OrderSendRetry(req, res))
    {
        Print(StringFormat("[LOI PARTIAL] ticket=%llu vol=%.2f retcode=%d | %s",
            ticket, closeVol, res.retcode, res.comment));
        return false;
    }

    Print(StringFormat("[PARTIAL] OK dong %.2f lot tu ticket=%llu", closeVol, ticket));
    return true;
}

//+------------------------------------------------------------------+
//| DONG TOAN BO CHUOI LENH KHI HET HAN TIME-BASED EXIT             |
//+------------------------------------------------------------------+
void CloseAllPositions(const string reason)
{
    Print(StringFormat("[TIME EXIT] %s -> Dong tat ca lenh", reason));
    if(g_hasOrder1 && g_ticket1 != 0) ClosePositionByTicket(g_ticket1);
    if(g_hasOrder2 && g_ticket2 != 0) ClosePositionByTicket(g_ticket2);
}

//+------------------------------------------------------------------+
//| ĐÓNG VỊ THẾ THEO TICKET (Đóng theo giá thị trường)             |
//+------------------------------------------------------------------+
bool ClosePositionByTicket(ulong ticket)
{
    if(ticket == 0 || !PositionSelectByTicket(ticket))
    {
        Print(StringFormat("[ĐÓNG] Không tìm thấy position ticket=%llu", ticket));
        return false;
    }

    ENUM_POSITION_TYPE posType = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
    double vol = PositionGetDouble(POSITION_VOLUME);

    MqlTradeRequest req = {};
    MqlTradeResult  res = {};

    req.action       = TRADE_ACTION_DEAL;
    req.symbol       = Symbol();
    req.volume       = vol;
    req.position     = ticket;
    req.magic        = InpMagicNumber;
    req.deviation    = InpSlippage;
    req.type_filling = GetFillType();

    if(posType == POSITION_TYPE_BUY)
    {
        req.type  = ORDER_TYPE_SELL;
        req.price = SymbolInfoDouble(Symbol(), SYMBOL_BID);
    }
    else
    {
        req.type  = ORDER_TYPE_BUY;
        req.price = SymbolInfoDouble(Symbol(), SYMBOL_ASK);
    }

    if(!OrderSendRetry(req, res))
    {
        Print(StringFormat("[LOI DONG] ticket=%llu retcode=%d | %s",
            ticket, res.retcode, res.comment));
        return false;
    }

    Print(StringFormat("[DONG] OK ticket=%llu vol=%.2f", ticket, vol));
    return true;
}


//+------------------------------------------------------------------+
//| SỰ KIỆN GIAO DỊCH - Cập nhật ticket real-time                   |
//| Kích hoạt ngay khi có deal được thực hiện (nhanh hơn OnTick)    |
//+------------------------------------------------------------------+
void OnTradeTransaction(const MqlTradeTransaction &trans,
                        const MqlTradeRequest     &request,
                        const MqlTradeResult      &result)
{
    // Chỉ xử lý khi có deal mới
    if(trans.type != TRADE_TRANSACTION_DEAL_ADD) return;

    ulong dealTicket = trans.deal;
    if(dealTicket == 0 || !HistoryDealSelect(dealTicket)) return;

    // Lọc theo symbol và magic
    if(HistoryDealGetString(dealTicket, DEAL_SYMBOL)          != Symbol())       return;
    if(HistoryDealGetInteger(dealTicket, DEAL_MAGIC)           != InpMagicNumber) return;

    ENUM_DEAL_ENTRY dealEntry = (ENUM_DEAL_ENTRY)HistoryDealGetInteger(dealTicket, DEAL_ENTRY);
    string          comment   = HistoryDealGetString(dealTicket, DEAL_COMMENT);
    ulong           posID     = HistoryDealGetInteger(dealTicket, DEAL_POSITION_ID);

    // --- Deal MỞ lệnh: Cập nhật ticket ngay lập tức ---
    if(dealEntry == DEAL_ENTRY_IN)
    {
        if(StringFind(comment, "L1") >= 0 && g_ticket1 == 0)
        {
            g_ticket1 = posID;
            Print(StringFormat("[TX] Ticket L1 cập nhật: %llu", g_ticket1));
        }
        else if(StringFind(comment, "L2") >= 0 && g_ticket2 == 0)
        {
            g_ticket2 = posID;
            Print(StringFormat("[TX] Ticket L2 cập nhật: %llu", g_ticket2));
        }
    }

    // --- Deal ĐÓNG lệnh: Log kết quả P&L ---
    if(dealEntry == DEAL_ENTRY_OUT || dealEntry == DEAL_ENTRY_INOUT)
    {
        double profit = HistoryDealGetDouble(dealTicket, DEAL_PROFIT)
                      + HistoryDealGetDouble(dealTicket, DEAL_SWAP)
                      + HistoryDealGetDouble(dealTicket, DEAL_COMMISSION);

        string lable  = (StringFind(comment, "L1") >= 0) ? "L1" :
                        (StringFind(comment, "L2") >= 0) ? "L2" : "??";
        string result_str = (profit >= 0)
                          ? StringFormat("THẮNG +$%.2f", profit)
                          : StringFormat("THUA  -$%.2f", MathAbs(profit));

        Print(StringFormat("[KẾT QUẢ] %s đóng | %s | Deal=%llu",
            lable, result_str, dealTicket));

        // Khi lệnh 2 đóng qua TP (tại giá entry lệnh 1):
        // Đảm bảo SL lệnh 1 được dời về entry (xử lý thêm tại SyncPositionState)
    }
}

//+------------------------------------------------------------------+
//| DANH SÁCH ĐIỂM CẦN TEST TRÊN TÀI KHOẢN DEMO                    |
//+------------------------------------------------------------------+
/*
+==================================================================+
|           DANH SÁCH ĐIỂM CẦN TEST KỸ TRÊN DEMO                  |
+==================================================================|
|                                                                   |
|  A. KIỂM TRA BỘ LỌC AN TOÀN                                     |
|  -----------------------------                                    |
|  [ ] 1. Session filter: EA không vào lệnh ngoài 7h-16h GMT       |
|         -> Kiểm tra Journal lúc 6:59 GMT và 16:00 GMT             |
|  [ ] 2. Spread filter: Vào giờ tin tức, spread tăng cao          |
|         -> EA phải log "[LỌC SPREAD]" và không mở lệnh            |
|  [ ] 3. News filter: Đặt thủ công giờ vào vùng NFP (T6 đầu      |
|         tháng 13:00-14:00 GMT) -> EA phải log "[TIN TỨC]"        |
|  [ ] 4. Max lệnh/ngày: Mở 10 lệnh thủ công cùng magic number    |
|         -> EA phải dừng và log "[GIỚI HẠN]"                      |
|  [ ] 5. Thua liên tiếp: Tạo 3 lệnh thua liên tiếp trong lịch sử |
|         -> EA phải log "[DỪNG BOT]" và không mở lệnh mới         |
|  [ ] 6. Reset ngày: Sau 00:00 GMT, bot phải tự bật lại          |
|                                                                   |
|  B. KIỂM TRA TÍN HIỆU ĐA KHUNG                                  |
|  ------------------------------                                   |
|  [ ] 7. H4 trend: Quan sát Journal khi giá vượt/phá EMA21 H4    |
|         -> Log H4 phải thay đổi chiều đúng lúc                   |
|  [ ] 8. H4/H1 conflict: Khi H4=Buy mà H1=Sell                   |
|         -> Log phải hiện "[LỌC] mâu thuẫn" -> không vào lệnh      |
|  [ ] 9. ADX filter: Dùng Strategy Tester, quan sát log ADX       |
|         -> Khi ADX < 25: "[ADX] Quá thấp"                        |
|         -> Khi ADX > 40: "[ADX] Quá cao"                         |
|  [ ] 10. EMA crossover H1: Xác nhận cross được phát hiện đúng   |
|          trong vòng 4 bars H1 -> log "[H1 EMA] Bullish/Bearish"  |
|  [ ] 11. Pullback EMA21 H1: Khi giá xa EMA21                    |
|          -> Log "[PULLBACK] Chưa pullback"                        |
|  [ ] 12. M15 xác nhận: Test với M15 đang ngược chiều H4         |
|          -> Log "[M15] không xác nhận"                           |
|  [ ] 13. M5 nến doji: Khi nến M5 thân rất nhỏ                  |
|          -> Log "[M5] Nến doji"                                   |
|                                                                   |
|  C. KIỂM TRA TÍNH TOÁN SL/TP                                    |
|  -----------------------------                                    |
|  [ ] 14. SL vượt ngưỡng 30 giá: Test khi ATR cao bất thường     |
|          -> Log "[LỌC] SL quá xa"                                 |
|  [ ] 15. SL chính xác: So sánh SL trên chart với log            |
|          "Structure=... ATR=... SL=..."                          |
|  [ ] 16. TP1 = Entry + 2×SL_dist | TP2 = Entry + 3×SL_dist     |
|          -> Kiểm tra tính toán chính xác bằng tay                |
|  [ ] 17. Broker stops level: ModifyPositionSL không bị lỗi      |
|          "Invalid stops" -> kiểm tra minDist được xử lý đúng     |
|                                                                   |
|  D. KIỂM TRA QUẢN LÝ LỆNH                                       |
|  -------------------------                                        |
|  [ ] 18. Không mở lệnh mới khi đang có lệnh mở                  |
|          -> Kiểm tra trong Journal: EA phải return sớm            |
|  [ ] 19. Trailing TP1: Khi giá đạt TP1, SL phải dời về          |
|          Entry + 1 giá (Buy) hoặc Entry - 1 giá (Sell)          |
|  [ ] 20. Trailing 50%TP2: Khi giá đạt giữa TP1-TP2,            |
|          SL phải dời về TP1                                      |
|  [ ] 21. Lệnh 2 kích hoạt: Khi giá lùi đúng 50% SL dist        |
|          -> Phải mở L2 với đúng SL và TP                         |
|  [ ] 22. Lệnh 2 CHỈ mở 1 lần: Sau khi L2 đóng, giá lại lùi     |
|          -> EA không được mở L3                                   |
|  [ ] 23. Đóng L2 khi giá hồi về: Giá về trong 1 giá từ entry   |
|          -> L2 đóng, SL L1 về entry -> trailing tiếp tục          |
|  [ ] 24. Filling type: Test trên các loại broker khác nhau      |
|          (ECN/STP) -> không bị lỗi "Invalid fill mode"           |
|                                                                   |
|  E. KIỂM TRA STRATEGY TESTER                                     |
|  -----------------------------                                    |
|  [ ] 25. Backtest 6 tháng với OHLC on M1 (Every tick không cần) |
|          -> Kiểm tra số lệnh, win rate, drawdown hợp lý          |
|  [ ] 26. Forward test 2-4 tuần trên demo real-time               |
|          -> So sánh kết quả backtest vs demo                      |
|  [ ] 27. Optimization: Thử các giá trị ADX Min 20-30,           |
|          ADX Max 35-50, EMA Fast 5-13 -> tìm tham số tối ưu      |
|  [ ] 28. Test với spread cao (30+ giá): Dùng Symbol Spread      |
|          = 300 points trong tester -> EA không mở lệnh            |
|                                                                   |
|  F. KIỂM TRA ĐẶC BIỆT                                           |
|  --------------------                                             |
|  [ ] 29. Mất kết nối internet giữa chừng: Reconnect lại         |
|          -> EA phải nhận ra lệnh cũ qua SyncPositionState        |
|  [ ] 30. Khởi động lại MT5 khi đang có lệnh mở                  |
|          -> EA phải resume đúng trạng thái (g_entry1, g_tp1...)  |
|          LƯU Ý: Hiện tại các biến g_* không được lưu qua restart|
|          -> Cần test: EA có trailing tiếp tục đúng không?         |
|  [ ] 31. 2 EA chạy song song cùng symbol khác magic number      |
|          -> Không được can thiệp lẫn nhau                        |
|                                                                   |
|  G. LƯU Ý QUAN TRỌNG VỀ RESTART EA                              |
|  ----------------------------------                               |
|  ! Khi EA restart (MT5 restart/EA reload), các biến g_entry1,   |
|    g_tp1, g_tp2, g_tradeDir, g_tp1Reached sẽ bị reset = 0.     |
|    Điều này có nghĩa là trailing stop sẽ KHÔNG hoạt động đúng  |
|    cho các lệnh đang mở từ trước.                               |
|    -> Giải pháp cho production: Lưu các giá trị này vào          |
|      GlobalVariable hoặc file CSV để persist qua restart.       |
+==================================================================+
*/

// === END OF FILE ===================================================
