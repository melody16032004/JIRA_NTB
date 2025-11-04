using System;
using System.Collections.Generic;
using JIRA_NTB.Models;
using JIRA_NTB.Models.Enums; // để dùng TaskStatusModel
using JIRA_NTB.Helpers;

namespace JIRA_NTB.ViewModels
{
    public class ProjectListViewModel
    {
        public List<ProjectCardViewModel> Projects { get; set; }
        public string SearchQuery { get; set; }
        public string FilterStatusId { get; set; }
        public List<Status> AllStatuses { get; set; }

        public ProjectListViewModel()
        {
            Projects = new List<ProjectCardViewModel>();
            AllStatuses = new List<Status>();
        }
    }

    public class ProjectCardViewModel
    {
        public string IdProject { get; set; }
        public string ProjectName { get; set; }
        public DateTime? StartDay { get; set; }
        public DateTime? EndDay { get; set; }
        public DateTime? CompletedDate { get; set; }

        // Dữ liệu gốc từ DB
        public string StatusId { get; set; }
        public string StatusName { get; set; }

        public int Progress { get; set; }
        public List<MemberAvatarViewModel> Members { get; set; }
        public int TotalMembers { get; set; }
        public int RemainingMembers => TotalMembers > 4 ? TotalMembers - 4 : 0;
        //public string ManagerName { get; set; }
        public MemberAvatarViewModel ProjectManager { get; set; }
        // ⚡ Lấy Enum thực tế dựa trên StatusId (mapping không cần đổi DB)
        public TaskStatusModel StatusEnum => StatusMapper.ToEnum(StatusId);

        // 🎨 Màu banner trên thẻ
        public string StatusColor => StatusEnum switch
        {
            TaskStatusModel.Todo => "from-yellow-500 to-orange-600",
            TaskStatusModel.InProgress => "from-blue-500 to-indigo-600",
            TaskStatusModel.Done => "from-green-500 to-emerald-600",
            _ => "from-gray-400 to-gray-600"
        };

        // 🎨 Màu badge hiển thị trạng thái
        public string StatusBadgeColor => StatusEnum switch
        {
            TaskStatusModel.Todo => "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
            TaskStatusModel.InProgress => "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
            TaskStatusModel.Done => "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
            _ => "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
        };

        // 🕒 Icon trạng thái
        public string StatusIcon => StatusEnum switch
        {
            TaskStatusModel.Todo => "clock",
            TaskStatusModel.InProgress => "play-circle",
            TaskStatusModel.Done => "check-circle-2",
            _ => "circle"
        };

        // 🎯 Màu thanh tiến độ
        public string ProgressColor => StatusEnum switch
        {
            TaskStatusModel.Todo => "from-yellow-500 to-orange-600",
            TaskStatusModel.InProgress => "from-indigo-500 to-indigo-600",
            TaskStatusModel.Done => "from-green-500 to-emerald-600",
            _ => "from-gray-400 to-gray-600"
        };

        // 🟢 Màu chữ phần trăm tiến độ
        public string ProgressTextColor => StatusEnum switch
        {
            TaskStatusModel.Todo => "text-yellow-600 dark:text-yellow-400",
            TaskStatusModel.InProgress => "text-indigo-600 dark:text-indigo-400",
            TaskStatusModel.Done => "text-green-600 dark:text-green-400",
            _ => "text-gray-600 dark:text-gray-400"
        };

        // 🧩 Hiển thị tên trạng thái thân thiện
        public string StatusDisplayName => StatusEnum switch
        {
            TaskStatusModel.Todo => "Đang lên kế hoạch",
            TaskStatusModel.InProgress => "Đang thực hiện",
            TaskStatusModel.Done => "Hoàn thành",
            _ => "Không xác định"
        };

        public ProjectCardViewModel()
        {
            Members = new List<MemberAvatarViewModel>();
        }
    }

    public class MemberAvatarViewModel
    {
        public string UserId { get; set; }
        public string UserName { get; set; }
        public string AvatarUrl { get; set; }
    }
}
