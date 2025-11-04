using JIRA_NTB.Models;

namespace JIRA_NTB.Repository
{
    public interface ITaskRepository
    {
        Task<List<TaskItemModel>> GetAllAsync();
        Task<TaskItemModel?> GetByIdAsync(string id);
        Task<List<TaskItemModel>> GetByProjectIdAsync(string projectId);
        Task<List<TaskItemModel>> GetByAssigneeIdAsync(string userId);
        Task UpdateAsync(TaskItemModel task);
        Task RefreshOverdueStatusAsync();
    }
}
