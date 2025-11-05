using JIRA_NTB.Repository;
using Microsoft.AspNetCore.Mvc;

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
            var projects = await _projectRepo.GetAllAsync();
            ViewBag.SelectedId = selectedId;
            ViewBag.ElementId = id;
            return View(projects);
        }
    }
}
