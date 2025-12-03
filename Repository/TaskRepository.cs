using JIRA_NTB.Data;
using JIRA_NTB.Models;
using JIRA_NTB.Models.Enums;
using JIRA_NTB.ViewModels;
using Microsoft.AspNetCore.Razor.TagHelpers;
using Microsoft.EntityFrameworkCore;
using static Microsoft.Extensions.Logging.EventSource.LoggingEventSource;

namespace JIRA_NTB.Repository
{
    public class TaskRepository : ITaskRepository
    {
        private readonly AppDbContext _context;

        public TaskRepository(AppDbContext context)
        {
            _context = context;
        }
        public async Task<List<TaskViewModel>> GetTaskViewModelsAsync(
      string userId,
      IList<string> roles,
      string? projectId = null,
      string? taskId = null)
        {
            IQueryable<TaskItemModel> query = _context.Tasks.Where(t => t.Project.Status.StatusName != TaskStatusModel.Deleted);

            // 1. Phân quyền
            if (roles.Contains("LEADER"))
            {
                query = query.Where(t => t.Project.UserId == userId);
            }
            else if (roles.Contains("EMPLOYEE"))
            {
                query = query.Where(t => t.Assignee_Id == userId);
            }

            // 2. Lọc
            if (!string.IsNullOrEmpty(projectId))
            {
                query = query.Where(t => t.ProjectId == projectId);
            }

            if (!string.IsNullOrEmpty(taskId))
            {
                query = query.Where(t => t.IdTask == taskId);
            }
            
            // 3. ✅ SELECT chỉ những field cần thiết
            var result = await query
                .Select(t => new TaskViewModel
                {
                    IdTask = t.IdTask,
                    NameTask = t.NameTask,
                    Priority = t.Priority,
                    Note = t.Note,
                    FileNote = t.FileNote,
                    StartDate = t.StartDate,
                    EndDate = t.EndDate,
                    CompletedDate = t.CompletedDate,
                    Overdue = t.Overdue,
                    ProjectId = t.ProjectId,
                    AssigneeId = t.Assignee_Id,
                    IsCompleted = t.Status != null && t.Status.StatusName == TaskStatusModel.Done,

                    // Chỉ lấy field cần thiết từ navigation
                    ProjectName = t.Project != null ? t.Project.ProjectName : "",
                    StatusName = t.Status != null ? t.Status.StatusName : default(TaskStatusModel),
                    AssigneeFullName = t.Assignee != null ? t.Assignee.FullName : null
                })
                .ToListAsync();

            return result;
        }
        public async Task<List<TaskViewModel>> GetTasksByStatusPagedViewModelAsync(
    string userId,
    IList<string> roles,
    string? statusId = null,
    int page = 1,
    int pageSize = 10,
    string? projectId = null)
        {
            IQueryable<TaskItemModel> query = _context.Tasks.Where(t => t.Project.Status.StatusName != TaskStatusModel.Deleted);

            // 🎯 Phân quyền
            if (roles.Contains("LEADER"))
            {
                query = query.Where(t => t.Project.UserId == userId);
            }
            else if (roles.Contains("EMPLOYEE"))
            {
                query = query.Where(t => t.Assignee_Id == userId);
            }

            // Filter theo project
            if (!string.IsNullOrEmpty(projectId))
            {
                query = query.Where(t => t.ProjectId == projectId);
            }

            // 🎯 Filter theo statusId
            if (!string.IsNullOrEmpty(statusId))
            {
                if (statusId == "False") // cột OVERDUE
                {
                    query = query.Where(t => t.Overdue
                                             && t.Status.StatusName != TaskStatusModel.Done
                                             && t.Status.StatusName != TaskStatusModel.Deleted);
                }
                else
                {
                    query = query.Where(t => t.Status.StatusId == statusId && !t.Overdue);
                }
            }

            // ✅ SELECT chỉ field cần thiết
            return await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(t => new TaskViewModel
                {
                    IdTask = t.IdTask,
                    NameTask = t.NameTask,
                    Priority = t.Priority,
                    Note = t.Note,
                    FileNote = t.FileNote,
                    StartDate = t.StartDate,
                    EndDate = t.EndDate,
                    CompletedDate = t.CompletedDate,
                    Overdue = t.Overdue,
                    ProjectId = t.ProjectId,
                    AssigneeId = t.Assignee_Id,
                    IsCompleted = t.Status != null && t.Status.StatusName == TaskStatusModel.Done,

                    // Chỉ lấy field cần thiết từ navigation
                    ProjectName = t.Project != null ? t.Project.ProjectName : "",
                    StatusName = t.Status != null ? t.Status.StatusName : default(TaskStatusModel),
                    AssigneeFullName = t.Assignee != null ? t.Assignee.FullName : null
                })
                .ToListAsync();
        }

        public async Task<List<TaskItemModel>> GetTasksByStatusPagedAsync(
    string userId,
    IList<string> roles,
    string? statusId = null,
    int page = 1,
    int pageSize = 10, string? projectId = null)
        {
            IQueryable<TaskItemModel> query = _context.Tasks.Where(t => t.Project.Status.StatusName != TaskStatusModel.Deleted)
                .Include(t => t.Project)
                .Include(t => t.Status)
                .Include(t => t.Assignee);

            // 🎯 Phân quyền
            if (roles.Contains("LEADER"))
            {
                query = query.Where(t => t.Project.UserId == userId);
            }
            else if (roles.Contains("EMPLOYEE"))
            {
                query = query.Where(t => t.Assignee_Id == userId);
            }
            // Filter theo project
            if (!string.IsNullOrEmpty(projectId))
            {
                query = query.Where(t => t.ProjectId == projectId);
            }
            // 🎯 Filter theo statusId
            if (!string.IsNullOrEmpty(statusId))
            {
                if (statusId == "False") // cột OVERDUE
                {
                    query = query.Where(t => t.Overdue
                                             && t.Status.StatusName != TaskStatusModel.Done
                                             && t.Status.StatusName != TaskStatusModel.Deleted);
                }
                else
                {
                    query = query.Where(t => t.Status.StatusId == statusId && !t.Overdue);
                }
            }

            return await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();
        }
        /// <summary>
        /// ✅ Đếm tổng số task theo status (có phân quyền)
        /// </summary>
        public async Task<int> GetTaskCountByStatusAsync(
            string userId,
            IList<string> roles,
            string? statusId = null,
            string? projectId = null)
        {
            IQueryable<TaskItemModel> query = _context.Tasks.Where(t => t.Project.Status.StatusName != TaskStatusModel.Deleted)
                .Include(t => t.Project)
                .Include(t => t.Status)
                .Include(t => t.Assignee);

            // 🎯 Phân quyền
            if (roles.Contains("LEADER"))
            {
                query = query.Where(t => t.Project.UserId == userId);
            }
            else if (roles.Contains("EMPLOYEE"))
            {
                query = query.Where(t => t.Assignee_Id == userId);
            }

            // Filter theo project
            if (!string.IsNullOrEmpty(projectId))
            {
                query = query.Where(t => t.ProjectId == projectId);
            }

            // 🎯 Filter theo statusId
            if (!string.IsNullOrEmpty(statusId))
            {
                if (statusId == "False") // cột OVERDUE
                {
                    query = query.Where(t => t.Overdue
                                             && t.Status.StatusName != TaskStatusModel.Done
                                             && t.Status.StatusName != TaskStatusModel.Deleted);
                }
                else
                {
                    query = query.Where(t => t.Status.StatusId == statusId && !t.Overdue);
                }
            }

            return await query.CountAsync();
        }
        public async Task<TaskItemModel?> GetByIdAsync(string id)
        {
            return await _context.Tasks.Where(t => t.Project.Status.StatusName != TaskStatusModel.Deleted)
                .Include(t => t.Project)
                .Include(t => t.Status)
                .Include(t => t.Assignee)
                .FirstOrDefaultAsync(t => t.IdTask == id);
        }

        public async Task<TaskItemModel?> GetByIdFilteredAsync(string taskId, string userId, IList<string> roles)
        {
            var query = _context.Tasks.Where(t => t.Project.Status.StatusName != TaskStatusModel.Deleted)
                .Include(t => t.Project)
                .Include(t => t.Status)
                .Include(t => t.Assignee)
                .AsQueryable();

            if (roles.Contains("LEADER"))
            {
                query = query.Where(t => t.Project.UserId == userId);
            }
            else if (roles.Contains("EMPLOYEE"))
            {
                query = query.Where(t => t.Assignee_Id == userId);
            }

            return await query.FirstOrDefaultAsync(t => t.IdTask == taskId);
        }

        public async Task<List<TaskItemModel>> GetByProjectIdAsync(string projectId, string userId, IList<string> roles)
        {
            var query = _context.Tasks.Where(t => t.Project.Status.StatusName != TaskStatusModel.Deleted)
                .Include(t => t.Status)
                .Include(t => t.Assignee)
                .Where(t => t.ProjectId == projectId)
                .AsQueryable();
            if (roles.Contains("LEADER"))
            {
                query = query.Where(t => t.Project.UserId == userId);
            }   
            else if (roles.Contains("EMPLOYEE"))
            {
                query = query.Where(t => t.Assignee_Id == userId);
            }
            return await query.ToListAsync();
        }

        public async Task<List<TaskItemModel>> GetByAssigneeIdAsync(string userId)
        {
            return await _context.Tasks.Where(t => t.Project.Status.StatusName != TaskStatusModel.Deleted)
                .Include(t => t.Project)
                .Include(t => t.Status)
                .Where(t => t.Assignee_Id == userId)
                .ToListAsync();
        }
        public async Task RefreshOverdueStatusAsync()
        {
            var today = DateTime.Now.Date;

            // Lệnh này sẽ chạy thẳng xuống SQL -> Update ngay lập tức
            await _context.Tasks
                .Where(t => t.Project.Status.StatusName != TaskStatusModel.Deleted) // Project chưa xóa
                .Where(t => t.EndDate.HasValue && t.EndDate.Value.Date < today)     // Đã quá hạn
                .Where(t => t.Status.StatusName != TaskStatusModel.Done)            // Chưa làm xong
                .Where(t => t.Overdue == false)                                     // Chỉ lấy cái nào chưa đánh dấu Overdue
                .ExecuteUpdateAsync(s => s.SetProperty(t => t.Overdue, true));      // UPDATE Tasks SET Overdue = 1 ...
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
        public async Task AddLogAsync(LogTaskModel log)
        {
            await _context.LogTasks.AddAsync(log);
        }

        public async Task SaveChangesAsync()
        {
            await _context.SaveChangesAsync();
        }
        public async Task AddStatusLog(LogStatusUpdate log)
        {
            await _context.LogStatusUpdates.AddAsync(log);
            await _context.SaveChangesAsync();
        }
        public async Task<List<TaskItemModel>> GetSchedule(string userId)
        {
            return await _context.Tasks
                .Where(t => t.Assignee_Id == userId &&
                            t.StartDate != null &&
                            t.EndDate != null && (t.Status.StatusName != TaskStatusModel.Done 
                                || t.Status.StatusName != TaskStatusModel.Deleted))
                .OrderBy(t => t.StartDate)
                .ToListAsync();
        }
    }
}
