using JIRA_NTB.Data;
using JIRA_NTB.Models;
using JIRA_NTB.Models.Enums;
using Microsoft.AspNetCore.Razor.TagHelpers;
using Microsoft.EntityFrameworkCore;

namespace JIRA_NTB.Repository
{
    public class TaskRepository : ITaskRepository
    {
        private readonly AppDbContext _context;

        public TaskRepository(AppDbContext context)
        {
            _context = context;
        }

        public async Task<List<TaskItemModel>> GetAllAsync()
        {
            return await _context.Tasks
                .Include(t => t.Project)
                .Include(t => t.Status)
                .Include(t => t.Assignee)
                .ToListAsync();
        }
        public async Task<List<TaskItemModel>> GetAllFilteredAsync(UserModel user, IList<string> roles)
        {
            IQueryable<TaskItemModel> query = _context.Tasks
                .Include(t => t.Project)
                .Include(t => t.Status)
                .Include(t => t.Assignee);

            // 🎯 Phân quyền lọc task
            if (roles.Contains("LEADER"))
            {
                // Leader -> task trong các project mà mình quản lý
                query = query.Where(t => t.Project.UserId == user.Id);
            }
            else if (roles.Contains("EMPLOYEE"))
            {
                // Employee -> chỉ task mình được assign
                query = query.Where(t => t.Assignee_Id == user.Id);
            }
            return await query.ToListAsync();
        }
        public async Task<TaskItemModel?> GetByIdAsync(string id)
        {
            return await _context.Tasks
                .Include(t => t.Project)
                .Include(t => t.Status)
                .Include(t => t.Assignee)
                .FirstOrDefaultAsync(t => t.IdTask == id);
        }

        public async Task<TaskItemModel?> GetByIdFilteredAsync(string taskId, UserModel user, IList<string> roles)
        {
            var query = _context.Tasks
                .Include(t => t.Project)
                .Include(t => t.Status)
                .Include(t => t.Assignee)
                .AsQueryable();

            if (roles.Contains("LEADER"))
            {
                query = query.Where(t => t.Project.UserId == user.Id);
            }
            else if (roles.Contains("EMPLOYEE"))
            {
                query = query.Where(t => t.Assignee_Id == user.Id);
            }

            return await query.FirstOrDefaultAsync(t => t.IdTask == taskId);
        }

        public async Task<List<TaskItemModel>> GetByProjectIdAsync(string projectId)
        {
            return await _context.Tasks
                .Include(t => t.Status)
                .Include(t => t.Assignee)
                .Where(t => t.ProjectId == projectId)
                .ToListAsync();
        }

        public async Task<List<TaskItemModel>> GetByAssigneeIdAsync(string userId)
        {
            return await _context.Tasks
                .Include(t => t.Project)
                .Include(t => t.Status)
                .Where(t => t.Assignee_Id == userId)
                .ToListAsync();
        }
        public async Task RefreshOverdueStatusAsync()
        {
            var tasks = await _context.Tasks
                .Include(t => t.Status)
                .Where(t => t.EndDate.HasValue)
                .ToListAsync();

            foreach (var t in tasks)
            {
                bool shouldBeOverdue =
                    t.EndDate.Value < DateTime.Now &&
                    t.Status?.StatusName != TaskStatusModel.Done;
                if (t.Overdue != shouldBeOverdue)
                {
                    t.Overdue = shouldBeOverdue;
                }
            }

            await _context.SaveChangesAsync();
        }
        public async Task UpdateAsync(TaskItemModel task)
        {
            _context.Tasks.Update(task);
            await _context.SaveChangesAsync();
        }
        public async Task AddAsync(TaskItemModel task)
        {
            _context.Tasks.Add(task);
            await _context.SaveChangesAsync();
        }
        public async Task DeleteAsync(string id)
        {
            var task = await _context.Tasks.FindAsync(id);
            if (task != null)
            {
                _context.Tasks.Remove(task);
                await _context.SaveChangesAsync();
            }
        }
    }
}
