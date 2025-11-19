using System.ComponentModel.DataAnnotations;

namespace JIRA_NTB.Models
{
    public class SetTime
    {
        [Key]
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public TimeOnly? Time { get; set; }
        [StringLength(50)]
        public string? Title { get; set; }
    }
}
