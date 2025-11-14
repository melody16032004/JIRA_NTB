using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace JIRA_NTB.Models
{
    public class CheckIn
    {
        [Key]
        public required string Id { get; set; }

        [Required]
        public DateTime TimeCheckIn { get; set; }

        public string? Note { get; set; }

        public string? Image { get; set; }

        // Khóa ngoại
        [Required]
        public string UserId { get; set; }

        // Navigation property
        [ForeignKey(nameof(UserId))]
        public UserModel User { get; set; } = null!;
    }
}
