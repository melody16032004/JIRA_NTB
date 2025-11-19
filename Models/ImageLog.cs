using System.ComponentModel.DataAnnotations;

namespace JIRA_NTB.Models
{
    public class ImageLog
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        [StringLength(30)]
        public string? MacAddress { get; set; }
        public string? UrlImage { get; set; }
        public DateTime CreateAt { get; set; }
    }
}
