using JIRA_NTB.Models;
using JIRA_NTB.Repository;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace JIRA_NTB.Components
{
    public class ProjectSelectViewComponent : ViewComponent
    {
        private readonly IProjectRepository _projectRepo;
        private readonly UserManager<UserModel> _userManager;

        public ProjectSelectViewComponent(IProjectRepository projectRepo, UserManager<UserModel> userManager)
        {
            _projectRepo = projectRepo;
            _userManager = userManager;
        }

        public async Task<IViewComponentResult> InvokeAsync(string id = "taskProject", string? selectedId = null)
        {
            var user = await _userManager.GetUserAsync(HttpContext.User);
            var roles = await _userManager.GetRolesAsync(user);

            List<ProjectModel> projects;
            projects = await _projectRepo.GetAllFilteredAsync(user, roles);

            ViewBag.SelectedId = selectedId;
            ViewBag.ElementId = id;
            return View(projects);
        }
    }
}
