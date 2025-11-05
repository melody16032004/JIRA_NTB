using JIRA_NTB.Models;

namespace JIRA_NTB.Repository
{
    public interface IUserRepository
    {
        Task<List<UserModel>> GetAllAsync();
        Task<UserModel> GetUserById(string id);
        Task<IEnumerable<UserModel>> GetMembersByProjectAsync(string projectId);

    }
}
