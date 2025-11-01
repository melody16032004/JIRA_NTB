using System.ComponentModel.DataAnnotations;

namespace JIRA_NTB.Models
{
    public class DepartmentModel
    {
        [Key]
        public string IdDepartment { get; set; }

        [Required, MaxLength(100)]
        public string DepartmentName { get; set; }

        public ICollection<UserModel>? Users { get; set; }
    }
}
