using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace JIRA_NTB.Models
{
    public class LogStatusUpdate
    {
        [Key]
        public string LogId { get; set; } = Guid.NewGuid().ToString();
        public string IdTask { get; set; }
        [ForeignKey("IdTask")]
        public TaskItemModel Task { get; set; }

        public string IdUserUpdate { get; set; }
        [ForeignKey("IdUserUpdate")]
        public UserModel User { get; set; }
        public DateTime updateAt { get; set; } = DateTime.Now;
        public string? PreviousStatusId { get; set; }
        public string? NewStatusId { get; set; }

    }
}
