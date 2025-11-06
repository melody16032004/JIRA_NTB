using JIRA_NTB.Models;

namespace JIRA_NTB.ViewModels
{
    public class DashboardViewModel
    {
        public List<ProjectModel> Projects { get; set; }
        public List<DepartmentModel> Departments { get; set; }
    }
}
