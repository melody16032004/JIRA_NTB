namespace JIRA_NTB.Admin.ViewModels
{
	public class ManageRolesViewModel
	{
		public string? UserId { get; set; }
		public string? Email { get; set; }
		public List<RoleViewModel> Roles { get; set; }
	}
	public class RoleViewModel
	{
		public string? RoleName { get; set; }
		public bool IsSelected { get; set; }
	}
}
