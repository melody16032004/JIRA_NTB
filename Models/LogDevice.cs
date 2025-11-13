using System.ComponentModel.DataAnnotations;

namespace JIRA_NTB.Models
{
    public class LogDevice
    {
        [Key]
        public string IdLog { get; set; } = Guid.NewGuid().ToString();

        [MaxLength(200)]
        public string? DeviceId { get; set; }

        [MaxLength(100)]
        public string? AppName { get; set; }

        public DateTime TimeStart { get; set; } = DateTime.UtcNow;

        [MaxLength(50)]
        public string? IPV4 { get; set; }

        public DateTime? TimeEnd { get; set; }
    }
}
