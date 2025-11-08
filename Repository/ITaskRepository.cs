using JIRA_NTB.Models;

namespace JIRA_NTB.Repository
{
    public interface ITaskRepository
    {
        Task<List<TaskItemModel>> GetAllAsync();
        Task<List<TaskItemModel>> GetAllFilteredAsync(UserModel user, IList<string> roles);
        Task<TaskItemModel?> GetByIdFilteredAsync(string taskId, UserModel user, IList<string> roles);
        Task<TaskItemModel?> GetByIdAsync(string id);
        Task<List<TaskItemModel>> GetByProjectIdAsync(string projectId, UserModel user, IList<string> roles);
        Task<List<TaskItemModel>> GetByAssigneeIdAsync(string userId);
        Task UpdateAsync(TaskItemModel task);
        Task RefreshOverdueStatusAsync();
        Task AddAsync(TaskItemModel task);
        Task DeleteAsync(string id);
    }
}
