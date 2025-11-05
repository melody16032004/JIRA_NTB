using System.ComponentModel.DataAnnotations;

namespace JIRA_NTB.ViewModels
{
    public class CreateTaskRequest
    {
        [Required(ErrorMessage = "Tên nhiệm vụ không được để trống")]
        [StringLength(200, ErrorMessage = "Tên nhiệm vụ tối đa 200 ký tự")]
        public string NameTask { get; set; } = null!;

        [StringLength(1000, ErrorMessage = "Ghi chú tối đa 1000 ký tự")]
        public string? Note { get; set; }

        [StringLength(10)]
        public string? Priority { get; set; } = "Low";

        [DataType(DataType.DateTime)]
        public DateTime? StartDate { get; set; }

        [DataType(DataType.DateTime)]
        public DateTime? EndDate { get; set; }

        // ID người thực hiện (Assignee)
        public string? AssigneeId { get; set; }

        // ID dự án
        [Required(ErrorMessage = "Vui lòng chọn dự án")]
        public string ProjectId { get; set; } = null!;

        // Upload nhiều file
        public IFormFileCollection? Files { get; set; }
    }
}
