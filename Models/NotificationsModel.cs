using System.ComponentModel.DataAnnotations;

namespace JIRA_NTB.Models
{
    public class NotificationsModel
    {
        [Key]
        public string Id { get; set; } = Guid.NewGuid().ToString();

        [Required]
        public string UserId { get; set; }

        [MaxLength(255)]
        public string Title { get; set; }
        
        public string Message { get; set; }

        public bool IsRead { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.Now;
    }
}
