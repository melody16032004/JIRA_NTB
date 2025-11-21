namespace JIRA_NTB.ViewModels
{
    public class LogGroupViewModel
    {
        // Class chứa thông tin chi tiết của từng bức ảnh
        public class ImageLogDetail
        {
            public string Id { get; set; }
            public string UrlImage { get; set; }
            public DateTime Time { get; set; } // Giờ chụp (ví dụ: 14:30:00)
        }

        // Class đại diện cho 1 dòng cha (đã gom nhóm)
        public class UserDailyGroupViewModel
        {
            public string FullName { get; set; }
            public string MacAddress { get; set; }
            public DateTime Date { get; set; } // Ngày (ví dụ: 20/11/2025)
            public int TotalImages { get; set; } // Tổng số ảnh trong ngày
            public List<ImageLogDetail> Logs { get; set; } = new List<ImageLogDetail>();
        }
    }
}
