using JIRA_NTB.Models;
using JIRA_NTB.Models.Enums;

namespace JIRA_NTB.Repository
{
    public interface IStatusRepository
    {
        Task<List<Status>> GetAllAsync();
        Task<Status?> GetByIdAsync(string id);
        Task<Status?> GetByStatusNameAsync(TaskStatusModel statusName);

    }
}
