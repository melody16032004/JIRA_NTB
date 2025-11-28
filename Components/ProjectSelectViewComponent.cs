using JIRA_NTB.Models;
using JIRA_NTB.Repository;
using Microsoft.AspNetCore.Mvc;
using JIRA_NTB.Extensions;
using System.Security.Claims;
namespace JIRA_NTB.Components
{
    public class ProjectSelectViewComponent : ViewComponent
    {
        private readonly IProjectRepository _projectRepo;

        public ProjectSelectViewComponent(IProjectRepository projectRepo)
        {
            _projectRepo = projectRepo;
        }

        public async Task<IViewComponentResult> InvokeAsync(string id = "taskProject", string? selectedId = null)
        {
            var claimsPrincipal = (ClaimsPrincipal)User;
            string userId = claimsPrincipal.GetUserId();
            List<string> roles = claimsPrincipal.GetUserRoles();
            List<ProjectModel> projects;
            projects = await _projectRepo.GetAllFilteredAsync(userId, roles);

            ViewBag.SelectedId = selectedId;
            ViewBag.ElementId = id;
            return View(projects);
        }
    }
}
