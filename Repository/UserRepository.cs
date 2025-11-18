using Microsoft.EntityFrameworkCore;
using JIRA_NTB.Models;
using JIRA_NTB.Data;

namespace JIRA_NTB.Repository
{
    public class UserRepository : IUserRepository
    {
        private readonly AppDbContext _context;

        public UserRepository(AppDbContext context)
        {
            _context = context;
        }

        public async Task<List<UserModel>> GetAllAsync()
        {
            return await _context.Users.ToListAsync();
        }
        public async Task<UserModel> GetUserById(string id)
        {
            return await _context.Users
                .FirstOrDefaultAsync(p => p.Id == id);
        }
        public async Task<IEnumerable<UserModel>> GetMembersByProjectAsync(string projectId, string? userId)
        {
            return await _context.ProjectManagers
                .Where(up => up.ProjectId == projectId
                    && (userId == null || up.UserId != userId))
                .Include(up => up.User)
                .Select(up => new UserModel
                {
                    Id = up.User.Id,
                    UserName = up.User.FullName ?? ""
                })
                .ToListAsync();
        }
    }
}
