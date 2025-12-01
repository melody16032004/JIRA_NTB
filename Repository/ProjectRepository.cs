using JIRA_NTB.Data;
using JIRA_NTB.Models;
using JIRA_NTB.Models.Enums;
using Microsoft.EntityFrameworkCore;

namespace JIRA_NTB.Repository
{
    public class ProjectRepository : IProjectRepository
    {
        private readonly AppDbContext _context;

        public ProjectRepository(AppDbContext context)
        {
            _context = context;
        }

        public async Task<List<ProjectModel>> GetAllAsync()
        {
            return await _context.Projects
                .Include(p => p.Status)
                .Include(p => p.Manager)
                .ToListAsync();
        }
        public async Task<List<ProjectModel>> GetAllFilteredAsync(string userId, IList<string> roles)
        {
            IQueryable<ProjectModel> query = _context.Projects
                .Where(p => p.Status.StatusName != TaskStatusModel.Deleted);
                
            if (roles.Contains("LEADER"))
            {
                // Leader -> chỉ project mà mình quản lý
                query = query.Where(p => p.UserId == userId);
            }
            else if (roles.Contains("EMPLOYEE"))
            {
                // Employee -> chỉ project mình đang tham gia
                query = query.Where(p => _context.ProjectManagers
                    .Any(up => up.ProjectId == p.IdProject && up.UserId == userId));
            }

            return await query.ToListAsync();
        }

        public async Task<ProjectModel?> GetByIdAsync(string id)
        {
            return await _context.Projects
                .Include(p => p.Status)
                .Include(p => p.Manager)
                .FirstOrDefaultAsync(p => p.IdProject == id);
        }

        public async Task<List<ProjectModel>> GetByUserIdAsync(string userId)
        {
            return await _context.Projects
                .Include(p => p.Status)
                .Where(p => p.UserId == userId)
                .ToListAsync();
        }
    }
}
