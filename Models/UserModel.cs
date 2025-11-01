using Microsoft.AspNetCore.Identity;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Data;

namespace JIRA_NTB.Models
{
    public class UserModel : IdentityUser
    {
        public bool IsActive { get; set; } = true;
        public string? FullName { get; set; }
        public string? Avt { get; set; }

        public DateTime? Dob { get; set; }

        [MaxLength(10)]
        public string? Gender { get; set; }

        public string? IdDepartment { get; set; }

        [ForeignKey("IdDepartment")]
        public DepartmentModel? Department { get; set; }

        // Navigation
        public ICollection<TaskItemModel>? Tasks { get; set; }

        public ICollection<ProjectModel>? ManagedProjects { get; set; }

        public ICollection<ProjectManagerModel>? ProjectManagers { get; set; }
    }
}
