using JIRA_NTB.Models;

namespace JIRA_NTB.Repository
{
    public interface IProjectRepository
    {
        Task<List<ProjectModel>> GetAllAsync();
        Task<ProjectModel?> GetByIdAsync(string id);
        Task<List<ProjectModel>> GetByUserIdAsync(string userId);
    }
}
