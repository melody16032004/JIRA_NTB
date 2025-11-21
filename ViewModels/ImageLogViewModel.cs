namespace JIRA_NTB.ViewModels
{
    public class ImageLogViewModel
    {
        public string Id { get; set; }
        public string FullName { get; set; } // Tên lấy từ bảng Users
        public string MacAddress { get; set; }
        public string UrlImage { get; set; }
        public DateTime CreateAt { get; set; }
    }
}
