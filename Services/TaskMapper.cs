using AutoMapper;
using JIRA_NTB.Models;
using JIRA_NTB.Models.Enums;
using JIRA_NTB.ViewModels;

namespace JIRA_NTB.Services
{
    public static class TaskMapper
    {
        public static TaskViewModel ToViewModel(this TaskItemModel model)
        {
            if (model == null) return null;

            return new TaskViewModel
            {
                IdTask = model.IdTask,
                NameTask = model.NameTask,
                Priority = model.Priority,
                Note = model.Note,
                FileNote = model.FileNote,
                StartDate = model.StartDate,
                EndDate = model.EndDate,
                CompletedDate = model.CompletedDate,
                ProjectId = model.ProjectId,
                Status = model.Status,
                IsCompleted = model.Status?.StatusName == TaskStatusModel.Done,

                Project = model.Project != null ? new ProjectInfoViewModel
                {
                    IdProject = model.Project.IdProject,
                    ProjectName = model.Project.ProjectName
                } : null,

                Assignee = model.Assignee != null ? new AssigneeInfoViewModel
                {
                    Id = model.Assignee.Id,
                    FullName = model.Assignee.FullName,
                    Email = model.Assignee.Email
                } : null
            };
        }

        public static List<TaskViewModel> ToViewModelList(this IEnumerable<TaskItemModel> models)
        {
            return models?.Select(m => m.ToViewModel()).ToList() ?? new List<TaskViewModel>();
        }
    }
}
