using JIRA_NTB.Models;
using JIRA_NTB.ViewModels;

namespace JIRA_NTB.Service
{
    public interface ITaskService
    {
        Task<TaskBoardViewModel> GetTaskBoardAsync();
        Task<TaskStatusChangeResult> UpdateTaskStatusAsync(string taskId, string newStatusId);
        Task<TaskStatusChangeResult> UndoTaskStatusAsync(string taskId, string previousStatusId);
    }
}
