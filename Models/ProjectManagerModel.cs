using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace JIRA_NTB.Models
{
    [Table("ProjectManagers")]
    public class ProjectManagerModel
    {
            
        [Key, Column(Order = 0)]
        public string UserId { get; set; }

        [Key, Column(Order = 1)]
        public string ProjectId { get; set; }

        [ForeignKey("UserId")]
        public UserModel? User { get; set; }

        [ForeignKey("ProjectId")]
        public ProjectModel? Project { get; set; }
            
        
    }
}
