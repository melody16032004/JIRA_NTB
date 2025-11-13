using JIRA_NTB.ViewModels;

namespace JIRA_NTB.Repository
{
    public interface IProjectService
    {
        Task<ProjectDetailViewModel> GetProjectDetailAsync(string id);
    }
}
