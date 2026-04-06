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

//--- Thông số giao dịch đang mở
int      g_tradeDir          = 0;      // Chiều GD: 1=Buy, -1=Sell
double   g_entry1            = 0.0;   // Giá entry lệnh 1
double   g_sl                = 0.0;   // SL chung (cả 2 lệnh dùng chung)
double   g_tp1               = 0.0;   // TP1 (RR 1:2) - quản lý thủ công
double   g_tp2               = 0.0;   // TP2 (RR 1:3) - đặt trực tiếp vào lệnh
bool     g_tp1Reached        = false; // Cờ đã đạt TP1 chưa (cho trailing)

//--- Chống tín hiệu lặp trong cùng 1 bar M5
datetime g_lastSignalBar     = 0;


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

    //--- Kiểm tra tất cả handles hợp lệ
    if(g_d1EMA21Handle   == INVALID_HANDLE ||
       g_h4EMA21Handle   == INVALID_HANDLE ||
       g_h1EMAFastHandle == INVALID_HANDLE ||
       g_h1EMASlowHandle == INVALID_HANDLE ||
       g_h1ADXHandle     == INVALID_HANDLE ||
       g_m15EMA21Handle  == INVALID_HANDLE ||
       g_m5EMAFastHandle == INVALID_HANDLE ||
       g_m5ATRHandle     == INVALID_HANDLE)
    {
        Print("[LỖI NGHIÊM TRỌNG] Không thể khởi tạo indicator handles! Error: ", GetLastError());
        return INIT_FAILED;
    }

    //--- Khởi tạo ngày hiện tại để reset đếm hàng ngày
    g_currentDay = StringToTime(TimeToString(TimeCurrent(), TIME_DATE));

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

    Print("[EA] XAUUSD Multi-TF EA dừng. Lý do: ", reason);
}


//+------------------------------------------------------------------+
//| MAIN TICK - Hàm xử lý chính, gọi mỗi khi có giá mới            |
//+------------------------------------------------------------------+
void OnTick()
{
    //--- Bước 1: Reset bộ đếm hàng ngày khi sang ngày mới (00:00 GMT)
    CheckAndResetDaily();

    //--- Bước 2: Nếu bot đang dừng do thua liên tiếp, không làm gì
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

    // Reset order2 flag nếu không còn lệnh nào
    if(!g_hasOrder1 && !g_hasOrder2)
        g_order2EverOpened = false;
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
    MqlDateTime gmt;
    TimeToStruct(TimeCurrent(), gmt);

    bool inSession = (gmt.hour >= 7 && gmt.hour < 16);

    if(!inSession)
        LogThrottled("SESSION",
            StringFormat("[LỌC SESSION] Ngoài giờ GD | Hiện: %02d:%02d GMT | Cho phép: 07:00-16:00 GMT",
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
//| BỘ LỌC TIN TỨC: Chặn 30 phút trước/sau các sự kiện lớn         |
//| NFP, CPI, Fed Rate Decision, GDP                                 |
//| Ghi chú: Phiên bản này dùng lịch xấp xỉ (không cần API).       |
//|          Nên kiểm tra thủ công lịch kinh tế mỗi tuần.           |
//+------------------------------------------------------------------+
// Helper: true khi đang trong cửa sổ ±30 phút quanh newsHour:newsMin
bool IsInNewsWindow(int totalMin, int newsHour, int newsMin)
{
    int center = newsHour * 60 + newsMin;
    return (totalMin >= center - 30 && totalMin <= center + 30);
}

bool FilterNews()
{
    MqlDateTime gmt;
    TimeToStruct(TimeCurrent(), gmt);

    int dow      = gmt.day_of_week;
    int dom      = gmt.day;
    int mon      = gmt.mon;
    int totalMin = gmt.hour * 60 + gmt.min;

    // --- NFP: Thu 6 dau tien cua thang, 13:30 GMT ---
    if(dow == 5 && dom <= 7 && IsInNewsWindow(totalMin, 13, 30))
    {
        LogThrottled("NFP", "[TIN TUC] Vung NFP (Thu6 dau thang 13:30 GMT +-30p) -> Dung GD", 1800);
        return false;
    }

    // --- CPI / PPI: Thu 3 hoac Thu 4, tuan 2-3 thang, 13:30 GMT ---
    if((dow == 2 || dow == 3) && dom >= 8 && dom <= 21 && IsInNewsWindow(totalMin, 13, 30))
    {
        LogThrottled("CPI", "[TIN TUC] Vung CPI/PPI (Thu3/4 tuan 2-3, 13:30 GMT +-30p) -> Dung GD", 1800);
        return false;
    }

    // --- FED RATE DECISION: Thu 4, tuan 3-5, 19:00 GMT ---
    if(dow == 3 && dom >= 15 && IsInNewsWindow(totalMin, 19, 0))
    {
        LogThrottled("FED", "[TIN TUC] Vung Fed Rate Decision (Thu4 tuan 3+, 19:00 GMT +-30p) -> Dung GD", 1800);
        return false;
    }

    // --- GDP: Thu 4/5 cuoi quy (thang 1,4,7,10), 13:30 GMT ---
    if((mon==1||mon==4||mon==7||mon==10) && (dow==4||dow==5) && dom>=22 && IsInNewsWindow(totalMin,13,30))
    {
        LogThrottled("GDP", "[TIN TUC] Vung GDP cuoi quy (13:30 GMT +-30p) -> Dung GD", 1800);
        return false;
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
    const int BARS = 10; // Số bar H1 kiểm tra ngược về quá khứ

    double ema21[];
    ArraySetAsSeries(ema21, true);
    if(CopyBuffer(g_h1EMASlowHandle, 0, 1, BARS, ema21) <= 0) return false;

    double h1High[], h1Low[];
    ArraySetAsSeries(h1High, true);
    ArraySetAsSeries(h1Low, true);
    if(CopyHigh(Symbol(), PERIOD_H1, 1, BARS, h1High) <= 0) return false;
    if(CopyLow (Symbol(), PERIOD_H1, 1, BARS, h1Low)  <= 0) return false;

    for(int i = 0; i < BARS; i++)
    {
        double ema     = ema21[i];
        // Dung sai 0.15% của EMA (~= $3 khi vàng ở $2000)
        double tol     = ema * 0.0015;

        if(direction == 1) // Buy: Low phải chạm về EMA21 từ trên
        {
            if(h1Low[i] <= ema + tol) // Low chạm hoặc xuyên dưới EMA21
            {
                Print(StringFormat("[PULLBACK] Bar H1 -%d: Low=%.2f <= EMA21=%.2f+tol -> OK",
                    i+1, h1Low[i], ema));
                return true;
            }
        }
        else // Sell: High phải chạm về EMA21 từ dưới
        {
            if(h1High[i] >= ema - tol) // High chạm hoặc xuyên trên EMA21
            {
                Print(StringFormat("[PULLBACK] Bar H1 -%d: High=%.2f >= EMA21=%.2f-tol -> OK",
                    i+1, h1High[i], ema));
                return true;
            }
        }
    }

    // Kiểm tra thêm: khoảng cách hiện tại so với EMA21
    double curPrice = (direction == 1) ? SymbolInfoDouble(Symbol(), SYMBOL_BID)
                                       : SymbolInfoDouble(Symbol(), SYMBOL_ASK);
    double distPct  = MathAbs(curPrice - ema21[0]) / ema21[0] * 100.0;
    LogThrottled("NO_PULLBACK",
        StringFormat("[PULLBACK] Chưa pullback về EMA21 H1 trong %d bar. Khoảng cách: %.2f%%",
            BARS, distPct),
        900);
    return false;
}

//+------------------------------------------------------------------+
//| XÁC NHẬN XU HƯỚNG M15                                           |
//| Logic: Giá đóng cửa M15 phải cùng phía EMA21 M15 như H4         |
//+------------------------------------------------------------------+
bool ConfirmM15Trend(int direction)
{
    double ema21[];
    ArraySetAsSeries(ema21, true);
    if(CopyBuffer(g_m15EMA21Handle, 0, 1, 3, ema21) <= 0)
    {
        Print("[LỖI] Không đọc được EMA21 M15: ", GetLastError());
        return false;
    }

    double m15Close[];
    ArraySetAsSeries(m15Close, true);
    if(CopyClose(Symbol(), PERIOD_M15, 1, 3, m15Close) <= 0) return false;

    double lastClose = m15Close[0];
    double lastEMA   = ema21[0];
    bool   ok        = (direction == 1) ? (lastClose > lastEMA)
                                        : (lastClose < lastEMA);
    if(ok)
        Print(StringFormat("[M15] Xác nhận %s | Đóng=%.2f %s EMA21=%.2f",
            DirToStr(direction), lastClose,
            (direction==1 ? ">" : "<"), lastEMA));
    return ok;
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
    double atrVal = atrBuf[0]; // ATR của bar M5 đã đóng gần nhất

    // --- Tìm Swing Low/High cấu trúc M5 (30 bar gần nhất) ---
    const int SWING_BARS = 30;
    double m5High[], m5Low[];
    ArraySetAsSeries(m5High, true);
    ArraySetAsSeries(m5Low, true);

    if(CopyHigh(Symbol(), PERIOD_M5, 1, SWING_BARS, m5High) <= 0) return false;
    if(CopyLow (Symbol(), PERIOD_M5, 1, SWING_BARS, m5Low)  <= 0) return false;

    double structLevel = 0.0;
    bool   swingFound  = false;

    if(direction == 1) // Buy -> tìm Swing Low gần nhất
    {
        // Swing Low: bar [i] có Low thấp hơn cả [i-1] và [i+1]
        for(int i = 1; i < SWING_BARS - 1; i++)
        {
            if(m5Low[i] < m5Low[i-1] && m5Low[i] < m5Low[i+1])
            {
                structLevel = m5Low[i];
                swingFound  = true;
                Print(StringFormat("[SL] Swing Low tại bar-%d = %.2f", i+1, structLevel));
                break;
            }
        }
        if(!swingFound) // Fallback: Lowest Low trong 30 bar
        {
            structLevel = m5Low[ArrayMinimum(m5Low, 0, SWING_BARS)];
            Print(StringFormat("[SL] Fallback Lowest Low (30 bar) = %.2f", structLevel));
        }
        sl = structLevel - atrVal * 1.5; // Buffer bên dưới swing low (1.5×ATR tránh noise)
    }
    else // Sell -> tìm Swing High gần nhất
    {
        for(int i = 1; i < SWING_BARS - 1; i++)
        {
            if(m5High[i] > m5High[i-1] && m5High[i] > m5High[i+1])
            {
                structLevel = m5High[i];
                swingFound  = true;
                Print(StringFormat("[SL] Swing High tại bar-%d = %.2f", i+1, structLevel));
                break;
            }
        }
        if(!swingFound)
        {
            structLevel = m5High[ArrayMaximum(m5High, 0, SWING_BARS)];
            Print(StringFormat("[SL] Fallback Highest High (30 bar) = %.2f", structLevel));
        }
        sl = structLevel + atrVal * 1.5; // Buffer bên trên swing high (1.5×ATR tránh noise)
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

    bool sent = OrderSend(req, res);

    if(!sent || (res.retcode != TRADE_RETCODE_DONE && res.retcode != TRADE_RETCODE_PLACED))
    {
        Print(StringFormat("[LỖI MỞ L1] Retcode=%d | %s", res.retcode, res.comment));
        return false;
    }

    // --- Lưu trạng thái lệnh ---
    g_hasOrder1        = true;
    g_tradeDir         = direction;
    g_entry1           = (res.price > 0) ? res.price : req.price;
    g_sl               = sl;
    g_tp1              = tp1;
    g_tp2              = tp2;
    g_tp1Reached       = false;
    g_order2EverOpened = false;
    g_ticket1          = res.deal;  // deal ticket; position ticket sẽ cập nhật qua OnTradeTransaction/SyncPositionState
    g_dailyTradeCount++;

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
//| MỞ LỆNH 2 (Averaging - Chỉ mở 1 lần duy nhất)                  |
//| Điều kiện: Lệnh 1 lỗ đến 50% SL distance                       |
//| SL = giống lệnh 1 | TP = tại giá entry lệnh 1                   |
//+------------------------------------------------------------------+
void PlaceOrder2()
{
    // Chỉ mở 1 lần duy nhất trong chu kỳ lệnh
    if(g_order2EverOpened)
    {
        Print("[L2] Đã mở lần này, không mở lại.");
        return;
    }

    // Kiểm tra giới hạn lệnh ngày
    if(g_dailyTradeCount >= InpMaxDailyTrades)
    {
        Print(StringFormat("[L2] Không mở: đã đạt giới hạn %d lệnh/ngày", InpMaxDailyTrades));
        return;
    }

    MqlTradeRequest req = {};
    MqlTradeResult  res = {};

    req.action       = TRADE_ACTION_DEAL;
    req.symbol       = Symbol();
    req.volume       = InpVolume2;
    req.sl           = g_sl;    // Cùng SL với lệnh 1
    req.tp           = g_entry1; // TP tại giá entry của lệnh 1
    req.magic        = InpMagicNumber;
    req.comment      = "XAUUSD_L2_EA"; // "L2" để nhận biết
    req.deviation    = InpSlippage;
    req.type_filling = GetFillType();

    if(g_tradeDir == 1)
    {
        req.type  = ORDER_TYPE_BUY;
        req.price = SymbolInfoDouble(Symbol(), SYMBOL_ASK);
    }
    else
    {
        req.type  = ORDER_TYPE_SELL;
        req.price = SymbolInfoDouble(Symbol(), SYMBOL_BID);
    }

    bool sent = OrderSend(req, res);

    if(!sent || (res.retcode != TRADE_RETCODE_DONE && res.retcode != TRADE_RETCODE_PLACED))
    {
        Print(StringFormat("[LỖI MỞ L2] Retcode=%d | %s", res.retcode, res.comment));
        return;
    }

    g_hasOrder2        = true;
    g_order2EverOpened = true;
    g_ticket2          = res.deal;  // position ticket sẽ cập nhật qua OnTradeTransaction/SyncPositionState
    g_dailyTradeCount++;

    Print("+=========== LỆNH 2 MỞ THÀNH CÔNG ===========+");
    Print(StringFormat("| Chiều  : %-38s |", DirToStr(g_tradeDir)));
    Print(StringFormat("| Entry  : %-38.2f |", req.price));
    Print(StringFormat("| SL     : %-30.2f (= SL lệnh 1) |", g_sl));
    Print(StringFormat("| TP     : %-28.2f (entry lệnh 1) |", g_entry1));
    Print(StringFormat("| Volume : %-35.2f lot |", InpVolume2));
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
        // --- Giai đoạn 1: Chờ TP1 ---
        bool hitTP1 = (g_tradeDir == 1) ? (curPrice >= g_tp1)
                                        : (curPrice <= g_tp1);
        if(hitTP1)
        {
            g_tp1Reached = true;

            // Dời SL về Entry + 1 giá (Buy) hoặc Entry - 1 giá (Sell)
            double newSL = (g_tradeDir == 1)
                           ? NormalizeDouble(g_entry1 + 1.0, digits) // +1 giá
                           : NormalizeDouble(g_entry1 - 1.0, digits); // -1 giá

            if(ModifyPositionSL(g_ticket1, newSL, true))
                Print(StringFormat("[TRAILING] OK TP1 đạt (%.2f) -> SL dời về Entry+1giá=%.2f",
                    g_tp1, newSL));
        }
    }
    else
    {
        // --- Giai đoạn 2: Trailing từ TP1 -> TP2 ---
        // Khoảng cách từ TP1 đến TP2
        double tp1ToTp2 = MathAbs(g_tp2 - g_tp1);

        // Mốc 50% giữa TP1 và TP2
        double midPoint = (g_tradeDir == 1) ? g_tp1 + tp1ToTp2 * 0.5
                                            : g_tp1 - tp1ToTp2 * 0.5;

        bool hitMid = (g_tradeDir == 1) ? (curPrice >= midPoint)
                                        : (curPrice <= midPoint);
        if(hitMid)
        {
            // Dời SL lên TP1 (lock in lợi nhuận RR 1:2)
            double newSL = NormalizeDouble(g_tp1, digits);
            bool   better = (g_tradeDir == 1) ? (newSL > curSL) : (newSL < curSL);

            if(better && ModifyPositionSL(g_ticket1, newSL, true))
                Print(StringFormat("[TRAILING] OK 50%%TP2 đạt (%.2f) -> SL dời lên TP1=%.2f",
                    midPoint, g_tp1));
        }
    }
}

//+------------------------------------------------------------------+
//| KIỂM TRA VÀ KÍCH HOẠT MỞ LỆNH 2                               |
//| Điều kiện: Giá chạy ngược chiều bằng 50% khoảng cách SL        |
//+------------------------------------------------------------------+
void CheckAndTriggerOrder2(double curPrice, double slDist)
{
    // Trigger L2 o 85% cua SL distance:
    // - Chi mo khi gia gan cham SL (con 15% duong den SL)
    // - Dam bao L1 co du co hoi hoat dong truoc khi co L2
    // - Khi L1 on dinh (win rate tot), co the giam ve 70%
    double triggerDist = slDist * 0.85;
    bool   trigger     = false;

    if(g_tradeDir == 1  && curPrice <= g_entry1 - triggerDist) trigger = true;
    if(g_tradeDir == -1 && curPrice >= g_entry1 + triggerDist) trigger = true;

    if(trigger)
    {
        Print(StringFormat("[L2] Kích hoạt! Giá=%.2f | Entry=%.2f | 70%%SL=%.2f giá (SL=%.2f)",
            curPrice, g_entry1, triggerDist, g_sl));
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
    int    digits = (int)SymbolInfoInteger(Symbol(), SYMBOL_DIGITS);
    bool   doClose = false;

    // Giá hồi về trong vòng 1 giá so với entry lệnh 1
    if(g_tradeDir == 1 && curPrice >= g_entry1 - 1.0) doClose = true;
    if(g_tradeDir == -1 && curPrice <= g_entry1 + 1.0) doClose = true;

    if(doClose && g_hasOrder2 && g_ticket2 != 0)
    {
        Print(StringFormat("[2L] Giá hồi về gần entry (%.2f ~= entry %.2f ±1 giá) -> Đóng L2, SL L1->entry",
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

    if(!OrderSend(req, res))
    {
        Print(StringFormat("[LỖI ĐÓNG] ticket=%llu retcode=%d | %s",
            ticket, res.retcode, res.comment));
        return false;
    }

    Print(StringFormat("[ĐÓNG] OK ticket=%llu vol=%.2f", ticket, vol));
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
