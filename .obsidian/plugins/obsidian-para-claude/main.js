"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => ParaClaudePlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian2 = require("obsidian");

// src/para-sidebar-view.ts
var import_obsidian = require("obsidian");
var PARA_SIDEBAR_VIEW_TYPE = "para-sidebar";
var ParaSidebarView = class extends import_obsidian.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.refreshTimeout = null;
    this.cachedStats = null;
    this.cachedProjects = [];
    this.cachedAreas = [];
    this.plugin = plugin;
  }
  getViewType() {
    return PARA_SIDEBAR_VIEW_TYPE;
  }
  getDisplayText() {
    return "PARA Assistant";
  }
  getIcon() {
    return "folder-tree";
  }
  async onOpen() {
    await this.refresh();
    this.registerEvents();
  }
  async onClose() {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }
  }
  registerEvents() {
    this.registerEvent(
      this.app.vault.on("create", () => this.debouncedRefresh())
    );
    this.registerEvent(
      this.app.vault.on("delete", () => this.debouncedRefresh())
    );
    this.registerEvent(
      this.app.vault.on("rename", () => this.debouncedRefresh())
    );
    this.registerEvent(
      this.app.metadataCache.on("changed", () => this.debouncedRefresh())
    );
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => this.debouncedRefresh())
    );
  }
  debouncedRefresh() {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }
    this.refreshTimeout = setTimeout(() => {
      this.refresh();
    }, 500);
  }
  async refresh() {
    this.cachedStats = await this.calculateStats();
    this.cachedProjects = await this.getProjectData();
    this.cachedAreas = await this.getAreaData();
    this.render();
  }
  async calculateStats() {
    const files = this.app.vault.getMarkdownFiles();
    let projects = 0, areas = 0, resources = 0, archives = 0, unclassified = 0;
    let activeProjects = 0, overdueProjects = 0;
    const today = /* @__PURE__ */ new Date();
    for (const file of files) {
      const cache = this.app.metadataCache.getFileCache(file);
      const fm = cache?.frontmatter;
      const paraType = fm?.["para-type"] || fm?.para;
      if (!paraType) {
        if (file.path.startsWith(this.plugin.settings.projectsRoot)) {
          projects++;
          if (fm?.status !== "archived" && fm?.status !== "completed") {
            activeProjects++;
            if (fm?.deadline) {
              const deadline = new Date(fm.deadline);
              if (deadline < today) overdueProjects++;
            }
          }
        } else if (file.path.startsWith(this.plugin.settings.areasRoot)) {
          areas++;
        } else if (file.path.startsWith(this.plugin.settings.resourcesRoot)) {
          resources++;
        } else if (file.path.startsWith(this.plugin.settings.archivesRoot)) {
          archives++;
        } else {
          unclassified++;
        }
      } else {
        switch (paraType.toLowerCase()) {
          case "project":
            projects++;
            if (fm?.status !== "archived" && fm?.status !== "completed") {
              activeProjects++;
              if (fm?.deadline) {
                const deadline = new Date(fm.deadline);
                if (deadline < today) overdueProjects++;
              }
            }
            break;
          case "area":
            areas++;
            break;
          case "resource":
            resources++;
            break;
          case "archive":
            archives++;
            break;
          default:
            unclassified++;
        }
      }
    }
    return {
      projects,
      areas,
      resources,
      archives,
      unclassified,
      activeProjects,
      overdueProjects
    };
  }
  async getProjectData() {
    const projects = [];
    const files = this.app.vault.getMarkdownFiles().filter((f) => f.path.startsWith(this.plugin.settings.projectsRoot));
    for (const file of files) {
      const cache = this.app.metadataCache.getFileCache(file);
      const fm = cache?.frontmatter;
      if (fm?.["para-type"] === "project" || file.path.startsWith(this.plugin.settings.projectsRoot)) {
        projects.push({
          file,
          name: file.basename,
          status: fm?.status || "active",
          deadline: fm?.deadline,
          progress: fm?.progress || 0,
          outcome: fm?.outcome,
          created: fm?.created || file.stat.ctime.toString()
        });
      }
    }
    return projects.sort((a, b) => {
      if (!a.deadline && !b.deadline) return 0;
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    });
  }
  async getAreaData() {
    const areas = [];
    const files = this.app.vault.getMarkdownFiles().filter((f) => f.path.startsWith(this.plugin.settings.areasRoot));
    for (const file of files) {
      const cache = this.app.metadataCache.getFileCache(file);
      const fm = cache?.frontmatter;
      if (fm?.["para-type"] === "area" || file.path.startsWith(this.plugin.settings.areasRoot)) {
        areas.push({
          file,
          name: file.basename,
          standard: fm?.standard,
          lastReview: fm?.["last-review"],
          status: fm?.status || "active"
        });
      }
    }
    return areas.sort((a, b) => a.name.localeCompare(b.name));
  }
  render() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("para-sidebar-container");
    this.renderDashboard(container);
    this.renderTasksSection(container);
    this.renderActiveProjects(container);
    this.renderAreasMonitor(container);
    this.renderInboxManagement(container);
    this.renderQuickOperations(container);
    this.renderSettings(container);
  }
  renderDashboard(container) {
    const section = container.createEl("div", { cls: "para-section para-dashboard" });
    const header = section.createEl("div", { cls: "para-section-header" });
    (0, import_obsidian.setIcon)(header.createEl("span", { cls: "para-section-icon" }), "layout-dashboard");
    header.createEl("h3", { text: "PARA Dashboard", cls: "para-section-title" });
    const stats = section.createEl("div", { cls: "para-stats-grid" });
    if (this.cachedStats) {
      this.createStatCard(stats, "Projects", this.cachedStats.projects, "calendar-check");
      this.createStatCard(stats, "Areas", this.cachedStats.areas, "target");
      this.createStatCard(stats, "Resources", this.cachedStats.resources, "book-open");
      this.createStatCard(stats, "Archives", this.cachedStats.archives, "archive");
    }
    if (this.cachedStats && this.cachedStats.unclassified > 0) {
      const alert = section.createEl("div", {
        cls: "para-alert para-alert-warning",
        text: `${this.cachedStats.unclassified} unclassified items need attention`
      });
      const classifyBtn = alert.createEl("button", {
        text: "Classify",
        cls: "para-btn para-btn-sm"
      });
      classifyBtn.onclick = () => {
        this.plugin.app.commands.executeCommandById("para-claude:para-classify-batch");
      };
    }
    const actions = section.createEl("div", { cls: "para-quick-actions" });
    this.createActionButton(actions, "New Project", "plus-circle", () => {
      this.plugin.app.commands.executeCommandById("para-claude:para-new-project");
    });
    this.createActionButton(actions, "New Area", "target", () => {
      this.plugin.app.commands.executeCommandById("para-claude:para-new-area");
    });
    this.createActionButton(actions, "Quick Capture", "edit", () => {
      if (this.plugin.settings.enableQuickCapture) {
        this.plugin.app.commands.executeCommandById("para-claude:para-quick-capture");
      } else {
        new import_obsidian.Notice("Quick capture is disabled in settings");
      }
    });
  }
  renderActiveProjects(container) {
    const section = container.createEl("div", { cls: "para-section para-projects" });
    const header = section.createEl("div", { cls: "para-section-header para-collapsible" });
    const toggle = header.createEl("span", { cls: "para-collapse-icon" });
    (0, import_obsidian.setIcon)(toggle, "chevron-down");
    (0, import_obsidian.setIcon)(header.createEl("span", { cls: "para-section-icon" }), "calendar-check");
    const titleContainer = header.createEl("div", { cls: "para-title-container" });
    titleContainer.createEl("h3", { text: "Active Projects", cls: "para-section-title" });
    if (this.cachedStats) {
      const badge = titleContainer.createEl("span", {
        cls: "para-badge",
        text: this.cachedStats.activeProjects.toString()
      });
      if (this.cachedStats.overdueProjects > 0) {
        badge.addClass("para-badge-danger");
        badge.title = `${this.cachedStats.overdueProjects} overdue`;
      }
    }
    const content = section.createEl("div", { cls: "para-section-content" });
    if (this.cachedProjects.length === 0) {
      content.createEl("div", {
        cls: "para-empty-state",
        text: "No active projects. Create one to get started!"
      });
    } else {
      const activeProjects = this.cachedProjects.filter(
        (p) => p.status !== "archived" && p.status !== "completed"
      );
      activeProjects.slice(0, 10).forEach((project) => {
        this.renderProjectCard(content, project);
      });
      if (activeProjects.length > 10) {
        const showMore = content.createEl("button", {
          text: `Show ${activeProjects.length - 10} more...`,
          cls: "para-btn para-btn-ghost para-btn-sm"
        });
        showMore.onclick = () => {
        };
      }
    }
    header.onclick = () => {
      content.toggleClass("para-collapsed", !content.hasClass("para-collapsed"));
      (0, import_obsidian.setIcon)(toggle, content.hasClass("para-collapsed") ? "chevron-right" : "chevron-down");
    };
  }
  renderProjectCard(container, project) {
    const card = container.createEl("div", { cls: "para-project-card" });
    const cardHeader = card.createEl("div", { cls: "para-card-header" });
    const title = cardHeader.createEl("div", { cls: "para-card-title" });
    title.createEl("a", {
      text: project.name,
      cls: "para-link",
      href: project.file.path
    }).onclick = async (e) => {
      e.preventDefault();
      await this.app.workspace.getLeaf(false).openFile(project.file);
    };
    const status = cardHeader.createEl("span", {
      cls: `para-status para-status-${project.status.toLowerCase()}`,
      text: project.status
    });
    if (project.deadline || project.progress) {
      const details = card.createEl("div", { cls: "para-card-details" });
      if (project.deadline) {
        const deadline = new Date(project.deadline);
        const today = /* @__PURE__ */ new Date();
        const isOverdue = deadline < today;
        const daysUntil = Math.ceil((deadline.getTime() - today.getTime()) / (1e3 * 60 * 60 * 24));
        const deadlineEl = details.createEl("div", { cls: "para-deadline" });
        (0, import_obsidian.setIcon)(deadlineEl.createEl("span"), "calendar");
        const deadlineText = deadlineEl.createEl("span");
        if (isOverdue) {
          deadlineText.setText(`Overdue by ${Math.abs(daysUntil)} days`);
          deadlineText.addClass("para-overdue");
        } else if (daysUntil <= 3) {
          deadlineText.setText(`Due in ${daysUntil} days`);
          deadlineText.addClass("para-due-soon");
        } else {
          deadlineText.setText(`Due ${project.deadline}`);
        }
      }
      if (project.progress > 0) {
        const progressContainer = details.createEl("div", { cls: "para-progress" });
        const progressBar = progressContainer.createEl("div", { cls: "para-progress-bar" });
        const progressFill = progressBar.createEl("div", {
          cls: "para-progress-fill",
          attr: { style: `width: ${project.progress}%` }
        });
        progressContainer.createEl("span", {
          text: `${project.progress}%`,
          cls: "para-progress-text"
        });
      }
    }
    const actions = card.createEl("div", { cls: "para-card-actions" });
    this.createCardAction(actions, "Complete", "check", async () => {
      await this.markProjectComplete(project);
    });
    this.createCardAction(actions, "Edit", "edit", async () => {
      await this.app.workspace.getLeaf(false).openFile(project.file);
    });
  }
  renderAreasMonitor(container) {
    const section = container.createEl("div", { cls: "para-section para-areas" });
    const header = section.createEl("div", { cls: "para-section-header para-collapsible" });
    const toggle = header.createEl("span", { cls: "para-collapse-icon" });
    (0, import_obsidian.setIcon)(toggle, "chevron-down");
    (0, import_obsidian.setIcon)(header.createEl("span", { cls: "para-section-icon" }), "target");
    const titleContainer = header.createEl("div", { cls: "para-title-container" });
    titleContainer.createEl("h3", { text: "Areas Monitor", cls: "para-section-title" });
    if (this.cachedAreas.length > 0) {
      titleContainer.createEl("span", {
        cls: "para-badge",
        text: this.cachedAreas.length.toString()
      });
    }
    const content = section.createEl("div", { cls: "para-section-content" });
    if (this.cachedAreas.length === 0) {
      content.createEl("div", {
        cls: "para-empty-state",
        text: "No areas defined. Areas represent ongoing responsibilities."
      });
    } else {
      this.cachedAreas.forEach((area) => {
        this.renderAreaCard(content, area);
      });
    }
    header.onclick = () => {
      content.toggleClass("para-collapsed", !content.hasClass("para-collapsed"));
      (0, import_obsidian.setIcon)(toggle, content.hasClass("para-collapsed") ? "chevron-right" : "chevron-down");
    };
  }
  renderAreaCard(container, area) {
    const card = container.createEl("div", { cls: "para-area-card" });
    const cardHeader = card.createEl("div", { cls: "para-card-header" });
    const title = cardHeader.createEl("a", {
      text: area.name,
      cls: "para-link",
      href: area.file.path
    });
    title.onclick = async (e) => {
      e.preventDefault();
      await this.app.workspace.getLeaf(false).openFile(area.file);
    };
    const health = cardHeader.createEl("span", { cls: "para-health-indicator" });
    const needsReview = this.needsReview(area.lastReview);
    (0, import_obsidian.setIcon)(health, needsReview ? "alert-circle" : "check-circle");
    health.addClass(needsReview ? "para-needs-attention" : "para-healthy");
    if (area.standard) {
      const standard = card.createEl("div", {
        cls: "para-area-standard",
        text: `Standard: ${area.standard}`
      });
    }
    if (area.lastReview) {
      const review = card.createEl("div", {
        cls: "para-area-review",
        text: `Last review: ${area.lastReview}`
      });
      if (needsReview) {
        review.addClass("para-overdue");
      }
    }
  }
  renderInboxManagement(container) {
    const section = container.createEl("div", { cls: "para-section para-inbox" });
    const header = section.createEl("div", { cls: "para-section-header" });
    (0, import_obsidian.setIcon)(header.createEl("span", { cls: "para-section-icon" }), "inbox");
    const titleContainer = header.createEl("div", { cls: "para-title-container" });
    titleContainer.createEl("h3", { text: "Inbox Management", cls: "para-section-title" });
    if (this.cachedStats && this.cachedStats.unclassified > 0) {
      titleContainer.createEl("span", {
        cls: "para-badge para-badge-warning",
        text: this.cachedStats.unclassified.toString()
      });
    }
    const content = section.createEl("div", { cls: "para-section-content" });
    if (this.cachedStats && this.cachedStats.unclassified > 0) {
      const inboxAlert = content.createEl("div", { cls: "para-inbox-alert" });
      inboxAlert.createEl("div", {
        text: `${this.cachedStats.unclassified} items need classification`,
        cls: "para-inbox-count"
      });
      const actions = inboxAlert.createEl("div", { cls: "para-inbox-actions" });
      const classifyBtn = actions.createEl("button", {
        text: "Batch Classify",
        cls: "para-btn para-btn-primary para-btn-sm"
      });
      classifyBtn.onclick = () => {
        this.plugin.app.commands.executeCommandById("para-claude:para-classify-batch");
      };
      const quickBtn = actions.createEl("button", {
        text: "Quick Review",
        cls: "para-btn para-btn-sm"
      });
      quickBtn.onclick = () => {
        this.showUnclassifiedFiles();
      };
    } else {
      content.createEl("div", {
        cls: "para-empty-state para-success-state",
        text: "\u2713 All files are properly classified!"
      });
    }
    const recentSection = content.createEl("div", { cls: "para-recent-captures" });
    recentSection.createEl("h4", { text: "Recent Captures", cls: "para-subsection-title" });
    const recentFiles = this.getRecentCaptures();
    if (recentFiles.length > 0) {
      const recentList = recentSection.createEl("ul", { cls: "para-recent-list" });
      recentFiles.slice(0, 5).forEach((file) => {
        const item = recentList.createEl("li");
        const link = item.createEl("a", {
          text: file.basename,
          cls: "para-link"
        });
        link.onclick = async (e) => {
          e.preventDefault();
          await this.app.workspace.getLeaf(false).openFile(file);
        };
      });
    } else {
      recentSection.createEl("div", {
        cls: "para-empty-state",
        text: "No recent captures"
      });
    }
  }
  renderQuickOperations(container) {
    const section = container.createEl("div", { cls: "para-section para-operations" });
    const header = section.createEl("div", { cls: "para-section-header para-collapsible" });
    const toggle = header.createEl("span", { cls: "para-collapse-icon" });
    (0, import_obsidian.setIcon)(toggle, "chevron-down");
    (0, import_obsidian.setIcon)(header.createEl("span", { cls: "para-section-icon" }), "zap");
    header.createEl("h3", { text: "Quick Operations", cls: "para-section-title" });
    const content = section.createEl("div", { cls: "para-section-content" });
    const operations = content.createEl("div", { cls: "para-operations-grid" });
    this.createOperationButton(operations, "Classify Current", "tag", () => {
      this.plugin.app.commands.executeCommandById("para-claude:para-classify-move");
    });
    this.createOperationButton(operations, "Weekly Review", "calendar", () => {
      this.plugin.app.commands.executeCommandById("para-claude:para-weekly-review");
    });
    this.createOperationButton(operations, "Archive Completed", "archive", () => {
      this.plugin.app.commands.executeCommandById("para-claude:para-archive-completed");
    });
    this.createOperationButton(operations, "Project Review", "list-checks", () => {
      this.plugin.app.commands.executeCommandById("para-claude:para-project-review");
    });
    this.createOperationButton(operations, "Tasks Dashboard", "check-square", () => {
      this.plugin.app.commands.executeCommandById("para-claude:para-create-tasks-dashboard");
    });
    header.onclick = () => {
      content.toggleClass("para-collapsed", !content.hasClass("para-collapsed"));
      (0, import_obsidian.setIcon)(toggle, content.hasClass("para-collapsed") ? "chevron-right" : "chevron-down");
    };
  }
  renderTasksSection(container) {
    const section = container.createEl("div", { cls: "para-section para-tasks" });
    const header = section.createEl("div", { cls: "para-section-header para-collapsible" });
    const toggle = header.createEl("span", { cls: "para-collapse-icon" });
    (0, import_obsidian.setIcon)(toggle, "chevron-down");
    (0, import_obsidian.setIcon)(header.createEl("span", { cls: "para-section-icon" }), "check-square");
    const titleContainer = header.createEl("div", { cls: "para-title-container" });
    titleContainer.createEl("h3", { text: "Tasks Overview", cls: "para-section-title" });
    const tasksPlugin = this.app.plugins.plugins["obsidian-tasks-plugin"];
    if (!tasksPlugin) {
      const badge = titleContainer.createEl("span", {
        cls: "para-badge para-badge-warning",
        text: "Plugin Missing"
      });
      badge.title = "Tasks plugin not installed";
    }
    const content = section.createEl("div", { cls: "para-section-content" });
    if (!tasksPlugin) {
      const alert = content.createEl("div", { cls: "para-alert para-alert-warning" });
      alert.createEl("div", { text: "Tasks plugin not found" });
      const installBtn = alert.createEl("button", {
        text: "Install Tasks Plugin",
        cls: "para-btn para-btn-sm"
      });
      installBtn.onclick = () => {
        window.open("obsidian://show-plugin?id=obsidian-tasks-plugin");
      };
    } else {
      this.renderTasksOverview(content);
    }
    header.onclick = () => {
      content.toggleClass("para-collapsed", !content.hasClass("para-collapsed"));
      (0, import_obsidian.setIcon)(toggle, content.hasClass("para-collapsed") ? "chevron-right" : "chevron-down");
    };
  }
  renderTasksOverview(container) {
    const stats = container.createEl("div", { cls: "para-task-stats" });
    this.createTaskStatCard(stats, "Active", "?", "circle");
    this.createTaskStatCard(stats, "Due Soon", "?", "clock");
    this.createTaskStatCard(stats, "Overdue", "?", "alert-circle");
    const actions = container.createEl("div", { cls: "para-task-actions" });
    this.createTaskAction(actions, "Tasks Dashboard", "layout-dashboard", () => {
      this.plugin.app.commands.executeCommandById("para-claude:para-create-tasks-dashboard");
    });
    this.createTaskAction(actions, "Extract from Note", "extract", () => {
      this.plugin.app.commands.executeCommandById("para-claude:para-extract-tasks-current");
    });
    const note = container.createEl("div", {
      cls: "para-tasks-note",
      text: "Task counts require scanning vault files. Use Tasks Dashboard for live queries."
    });
  }
  createTaskStatCard(container, label, count, icon) {
    const card = container.createEl("div", { cls: "para-task-stat-card" });
    (0, import_obsidian.setIcon)(card.createEl("div", { cls: "para-task-stat-icon" }), icon);
    card.createEl("div", { text: count, cls: "para-task-stat-number" });
    card.createEl("div", { text: label, cls: "para-task-stat-label" });
  }
  createTaskAction(container, text, icon, onClick) {
    const button = container.createEl("button", { cls: "para-btn para-btn-task" });
    (0, import_obsidian.setIcon)(button.createEl("span"), icon);
    button.createEl("span", { text });
    button.onclick = onClick;
  }
  renderSettings(container) {
    const section = container.createEl("div", { cls: "para-section para-settings" });
    const header = section.createEl("div", { cls: "para-section-header para-collapsible" });
    const toggle = header.createEl("span", { cls: "para-collapse-icon" });
    (0, import_obsidian.setIcon)(toggle, "chevron-right");
    (0, import_obsidian.setIcon)(header.createEl("span", { cls: "para-section-icon" }), "settings");
    header.createEl("h3", { text: "Settings & Tools", cls: "para-section-title" });
    const content = section.createEl("div", { cls: "para-section-content para-collapsed" });
    const status = content.createEl("div", { cls: "para-plugin-status" });
    const apiStatus = this.plugin.settings.anthropicApiKey ? "\u2713 API Connected" : "\u26A0 No API Key";
    status.createEl("div", {
      text: `Status: ${apiStatus}`,
      cls: this.plugin.settings.anthropicApiKey ? "para-status-good" : "para-status-warning"
    });
    const quickSettings = content.createEl("div", { cls: "para-quick-settings" });
    quickSettings.createEl("h4", { text: "Quick Settings", cls: "para-subsection-title" });
    const dryRunToggle = quickSettings.createEl("label", { cls: "para-toggle" });
    const dryRunInput = dryRunToggle.createEl("input", { type: "checkbox" });
    dryRunInput.checked = this.plugin.settings.dryRun;
    dryRunToggle.createEl("span", { text: "Dry Run Mode" });
    dryRunInput.onchange = async () => {
      this.plugin.settings.dryRun = dryRunInput.checked;
      await this.plugin.saveSettings();
    };
    const tools = content.createEl("div", { cls: "para-tools" });
    tools.createEl("h4", { text: "Tools", cls: "para-subsection-title" });
    const toolsGrid = tools.createEl("div", { cls: "para-tools-grid" });
    this.createToolButton(toolsGrid, "Test API", "wifi", () => {
      this.plugin.app.commands.executeCommandById("para-claude:para-test-api");
    });
    this.createToolButton(toolsGrid, "Refresh Views", "refresh-cw", () => {
      this.plugin.app.commands.executeCommandById("para-claude:para-refresh-bases");
    });
    this.createToolButton(toolsGrid, "Setup Structure", "folder-plus", () => {
      this.plugin.app.commands.executeCommandById("para-claude:para-setup-structure");
    });
    this.createToolButton(toolsGrid, "Extract Tasks", "list-plus", () => {
      this.plugin.app.commands.executeCommandById("para-claude:para-extract-tasks-current");
    });
    header.onclick = () => {
      content.toggleClass("para-collapsed", !content.hasClass("para-collapsed"));
      (0, import_obsidian.setIcon)(toggle, content.hasClass("para-collapsed") ? "chevron-right" : "chevron-down");
    };
  }
  // Helper methods
  createStatCard(container, label, count, icon) {
    const card = container.createEl("div", { cls: "para-stat-card" });
    (0, import_obsidian.setIcon)(card.createEl("div", { cls: "para-stat-icon" }), icon);
    card.createEl("div", { text: count.toString(), cls: "para-stat-number" });
    card.createEl("div", { text: label, cls: "para-stat-label" });
  }
  createActionButton(container, text, icon, onClick) {
    const button = container.createEl("button", { cls: "para-btn para-btn-action" });
    (0, import_obsidian.setIcon)(button.createEl("span"), icon);
    button.createEl("span", { text });
    button.onclick = onClick;
  }
  createCardAction(container, text, icon, onClick) {
    const button = container.createEl("button", { cls: "para-btn para-btn-ghost para-btn-xs" });
    (0, import_obsidian.setIcon)(button, icon);
    button.title = text;
    button.onclick = onClick;
  }
  createOperationButton(container, text, icon, onClick) {
    const button = container.createEl("button", { cls: "para-btn para-btn-operation" });
    (0, import_obsidian.setIcon)(button.createEl("span"), icon);
    button.createEl("span", { text });
    button.onclick = onClick;
  }
  createToolButton(container, text, icon, onClick) {
    const button = container.createEl("button", { cls: "para-btn para-btn-tool para-btn-sm" });
    (0, import_obsidian.setIcon)(button.createEl("span"), icon);
    button.createEl("span", { text });
    button.onclick = onClick;
  }
  async markProjectComplete(project) {
    const content = await this.app.vault.read(project.file);
    const updatedContent = content.replace(
      /status:\s*\w+/,
      "status: completed"
    );
    await this.app.vault.modify(project.file, updatedContent);
    new import_obsidian.Notice(`Project "${project.name}" marked as completed!`);
    this.debouncedRefresh();
  }
  needsReview(lastReview) {
    if (!lastReview) return true;
    const reviewDate = new Date(lastReview);
    const now = /* @__PURE__ */ new Date();
    const daysSinceReview = (now.getTime() - reviewDate.getTime()) / (1e3 * 60 * 60 * 24);
    return daysSinceReview > 30;
  }
  getRecentCaptures() {
    const files = this.app.vault.getMarkdownFiles();
    const recentFiles = files.filter((f) => {
      const cache = this.app.metadataCache.getFileCache(f);
      return cache?.frontmatter?.["para-type"] === "inbox";
    }).sort((a, b) => b.stat.mtime - a.stat.mtime);
    return recentFiles;
  }
  async showUnclassifiedFiles() {
    const unclassified = this.app.vault.getMarkdownFiles().filter((f) => {
      const cache = this.app.metadataCache.getFileCache(f);
      const paraType = cache?.frontmatter?.["para-type"] || cache?.frontmatter?.para;
      return !paraType && !f.path.startsWith(this.plugin.settings.projectsRoot) && !f.path.startsWith(this.plugin.settings.areasRoot) && !f.path.startsWith(this.plugin.settings.resourcesRoot) && !f.path.startsWith(this.plugin.settings.archivesRoot);
    });
    const modal = new import_obsidian.Modal(this.app);
    modal.contentEl.createEl("h2", { text: "Unclassified Files" });
    const list = modal.contentEl.createEl("ul");
    unclassified.slice(0, 20).forEach((file) => {
      const item = list.createEl("li");
      const link = item.createEl("a", { text: file.path });
      link.onclick = async (e) => {
        e.preventDefault();
        modal.close();
        await this.app.workspace.getLeaf(false).openFile(file);
      };
    });
    if (unclassified.length > 20) {
      modal.contentEl.createEl("p", {
        text: `Showing first 20 of ${unclassified.length} unclassified files.`
      });
    }
    modal.open();
  }
};

// src/main.ts
var DEFAULTS = {
  anthropicApiKey: "",
  anthropicModel: "claude-opus-4-1",
  // Best model as of Aug 2025
  anthropicVersion: "2023-06-01",
  projectsRoot: "1. Projects",
  areasRoot: "2. Areas",
  resourcesRoot: "3. Resources",
  archivesRoot: "4. Archives",
  dryRun: true,
  maxTokens: 2e3,
  temperature: 0.2,
  autoBackup: true,
  showCostEstimate: true,
  useBasesForViews: true,
  useDataviewForAnalytics: false,
  autoCreateStructure: true,
  weeklyReviewDay: "Sunday",
  enableQuickCapture: true,
  archiveCompletedProjects: true,
  projectDeadlineWarningDays: 3
};
var OperationHistory = class {
  constructor() {
    this.history = [];
    this.maxHistory = 50;
  }
  add(op) {
    this.history.unshift(op);
    if (this.history.length > this.maxHistory) {
      this.history.pop();
    }
  }
  getLastOperation() {
    return this.history[0];
  }
  getHistory() {
    return [...this.history];
  }
  async undo(app) {
    const op = this.history.shift();
    if (!op) return false;
    try {
      switch (op.type) {
        case "move":
          if (op.originalPath && op.newPath) {
            const file = app.vault.getAbstractFileByPath(op.newPath);
            if (file) {
              await app.fileManager.renameFile(file, op.originalPath);
            }
          }
          break;
        case "modify":
          if (op.originalPath && op.originalContent !== void 0) {
            const file = app.vault.getAbstractFileByPath(op.originalPath);
            if (file) {
              await app.vault.modify(file, op.originalContent);
            }
          }
          break;
        case "create":
          if (op.newPath) {
            const file = app.vault.getAbstractFileByPath(op.newPath);
            if (file) {
              await app.vault.delete(file);
            }
          }
          break;
      }
      return true;
    } catch (e) {
      console.error("Undo failed:", e);
      return false;
    }
  }
};
async function callClaudeJSON(settings, system, user) {
  if (!settings.anthropicApiKey) {
    throw new Error("Add your Anthropic API key in Settings.");
  }
  const body = {
    model: settings.anthropicModel,
    max_tokens: settings.maxTokens,
    temperature: settings.temperature,
    system,
    messages: [{ role: "user", content: user }]
  };
  try {
    const res = await (0, import_obsidian2.requestUrl)({
      url: "https://api.anthropic.com/v1/messages",
      method: "POST",
      contentType: "application/json",
      body: JSON.stringify(body),
      headers: {
        "x-api-key": settings.anthropicApiKey,
        "anthropic-version": settings.anthropicVersion,
        "anthropic-dangerous-direct-browser-access": "true"
        // Sometimes needed for Obsidian
      }
    });
    if (res.status !== 200) {
      console.error("API Error Response:", res.status);
      const errorBody = res.json;
      const errorMessage = errorBody?.error?.message || errorBody?.message || res.text || "Unknown error";
      if (res.status === 404) {
        throw new Error(`API endpoint not found (404). This might mean:
1. The model '${settings.anthropicModel}' doesn't exist
2. The API version '${settings.anthropicVersion}' is incorrect
3. The API endpoint has changed
Error: ${errorMessage}`);
      } else if (res.status === 401) {
        throw new Error(`Authentication failed (401). Check your API key.
Error: ${errorMessage}`);
      } else if (res.status === 429) {
        throw new Error(`Rate limit exceeded (429). Wait and try again.
Error: ${errorMessage}`);
      } else {
        throw new Error(`Claude API error ${res.status}: ${errorMessage}`);
      }
    }
    const msg = res.json;
    const text = msg.content?.[0]?.text ?? "";
    try {
      return JSON.parse(text);
    } catch (e) {
      console.error("Failed to parse JSON from Claude response");
      throw new Error("Claude returned non-JSON. Response:\n" + text);
    }
  } catch (error) {
    console.error("Request failed with error:", error);
    console.error("Error stack:", error.stack);
    if (error.message?.includes("net::") || error.message?.includes("ENOTFOUND")) {
      throw new Error("Network error: Cannot reach Anthropic API. Check your internet connection.");
    }
    throw error;
  }
}
function estimateApiCost(inputTokens, outputTokens, model) {
  const pricing = {
    // Claude 4 models (Latest - Aug 2025)
    "claude-opus-4-1": { input: 0.015, output: 0.075 },
    "claude-opus-4-1-20250805": { input: 0.015, output: 0.075 },
    "claude-opus-4-0": { input: 0.015, output: 0.075 },
    "claude-opus-4-20250514": { input: 0.015, output: 0.075 },
    "claude-sonnet-4-0": { input: 3e-3, output: 0.015 },
    "claude-sonnet-4-20250514": { input: 3e-3, output: 0.015 },
    // Claude 3.7 models
    "claude-3-7-sonnet-latest": { input: 3e-3, output: 0.015 },
    "claude-3-7-sonnet-20250219": { input: 3e-3, output: 0.015 },
    // Claude 3.5 models (still supported but deprecating)
    "claude-3-5-haiku-latest": { input: 8e-4, output: 4e-3 },
    "claude-3-5-haiku-20241022": { input: 8e-4, output: 4e-3 },
    "claude-3-5-sonnet-latest": { input: 3e-3, output: 0.015 },
    "claude-3-5-sonnet-20241022": { input: 3e-3, output: 0.015 },
    "claude-3-5-sonnet-20240620": { input: 3e-3, output: 0.015 }
  };
  const modelPricing = pricing[model] || pricing["claude-opus-4-1"];
  return (inputTokens * modelPricing.input + outputTokens * modelPricing.output) / 1e3;
}
function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}
async function createTasksFromClassification(app, file, tasks, settings) {
  if (!tasks || tasks.length === 0) return;
  const tasksPlugin = app.plugins.plugins["obsidian-tasks-plugin"];
  if (!tasksPlugin) {
    new import_obsidian2.Notice("Tasks plugin not installed. Tasks will be added as regular checkboxes.");
  }
  const content = await app.vault.read(file);
  const tasksSection = createTasksSection(tasks, file.path, settings);
  const updatedContent = content + "\n\n" + tasksSection;
  await app.vault.modify(file, updatedContent);
  new import_obsidian2.Notice(`Added ${tasks.length} task(s) to ${file.basename}`);
}
function createTasksSection(tasks, sourcePath, settings) {
  const lines = ["## \u{1F4CB} Extracted Tasks", ""];
  for (const task of tasks) {
    let taskLine = `- [ ] ${task.text}`;
    if (task.priority) {
      const priorityEmoji = {
        "highest": "\u{1F53A}",
        "high": "\u23EB",
        "medium": "\u{1F53C}",
        "low": "\u{1F53D}",
        "lowest": "\u23EC"
      };
      taskLine += ` ${priorityEmoji[task.priority]}`;
    }
    if (task.due) {
      taskLine += ` \u{1F4C5} ${task.due}`;
    }
    if (task.scheduled) {
      taskLine += ` \u23F3 ${task.scheduled}`;
    }
    if (task.recurrence) {
      taskLine += ` \u{1F501} ${task.recurrence}`;
    }
    if (task.tags && task.tags.length > 0) {
      taskLine += " " + task.tags.join(" ");
    }
    if (task.context) {
      taskLine += ` <!-- Context: ${task.context} -->`;
    }
    lines.push(taskLine);
  }
  lines.push("", "> Tasks extracted automatically from note content");
  return lines.join("\n");
}
async function createTasksDashboard(app, settings) {
  const dashboardContent = `---
para-type: dashboard
task-dashboard: true
created: ${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}
---

# \u{1F4CB} PARA Tasks Dashboard

## All Active Tasks

\`\`\`tasks
not done
group by filename
sort by priority reverse
sort by due
limit 50
\`\`\`

## Tasks by PARA Category

### \u{1F3AF} Project Tasks
\`\`\`tasks
not done
tag includes #project
group by tags
sort by due
\`\`\`

### \u{1F3AA} Area Tasks  
\`\`\`tasks
not done
tag includes #area
group by tags
sort by due
\`\`\`

### \u{1F4DA} Resource Tasks
\`\`\`tasks
not done
tag includes #resource
sort by due
\`\`\`

## Priority Tasks

### \u{1F53A} High Priority
\`\`\`tasks
not done
priority is above none
sort by due
limit 20
\`\`\`

### \u23F0 Due Soon
\`\`\`tasks
not done
due before in 7 days
sort by due
\`\`\`

### \u{1F4C5} Overdue
\`\`\`tasks
not done
due before today
sort by due reverse
\`\`\`

## Completed Recently
\`\`\`tasks
done after 7 days ago
sort by done reverse
limit 10
\`\`\`
`;
  const dashboardPath = "PARA-Tasks-Dashboard.md";
  const existing = app.vault.getAbstractFileByPath(dashboardPath);
  if (existing) {
    await app.vault.modify(existing, dashboardContent);
  } else {
    await app.vault.create(dashboardPath, dashboardContent);
  }
  new import_obsidian2.Notice("Tasks Dashboard created/updated!");
}
function ensureFrontmatter(content) {
  const fm = /^---\n([\s\S]*?)\n---\n?/m;
  const m = content.match(fm);
  if (m) {
    const yaml = m[1] ?? "";
    const body = content.slice(m[0].length);
    return { yaml, body, hasFM: true };
  }
  return { yaml: "", body: content, hasFM: false };
}
function mergeFrontmatter(yaml, updates) {
  const lines = yaml.split("\n").filter((l) => l.trim().length > 0);
  const map = /* @__PURE__ */ new Map();
  for (const l of lines) {
    const idx = l.indexOf(":");
    if (idx > -1) {
      const key = l.slice(0, idx).trim();
      const val = l.slice(idx + 1).trim();
      map.set(key, val);
    }
  }
  for (const [k, v] of Object.entries(updates)) {
    const value = typeof v === "string" ? `"${v.replace(/"/g, '\\"')}"` : Array.isArray(v) ? `[${v.map((x) => JSON.stringify(x)).join(", ")}]` : typeof v === "number" || typeof v === "boolean" ? String(v) : JSON.stringify(v);
    map.set(k, value);
  }
  const merged = Array.from(map.entries()).map(([k, v]) => `${k}: ${v}`).join("\n");
  return merged;
}
async function createBackup(app, file) {
  const backupDir = ".para-backups";
  const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
  const backupPath = `${backupDir}/${file.basename}-${timestamp}.md`;
  if (!await app.vault.adapter.exists(backupDir)) {
    await app.vault.createFolder(backupDir);
  }
  const content = await app.vault.read(file);
  await app.vault.create(backupPath, content);
  return backupPath;
}
async function ensureParaStructure(app, settings) {
  const folders = [
    settings.projectsRoot,
    settings.areasRoot,
    settings.resourcesRoot,
    settings.archivesRoot
  ];
  for (const folder of folders) {
    if (!await app.vault.adapter.exists(folder)) {
      await app.vault.createFolder(folder);
    }
  }
  const subFolders = [
    `${settings.projectsRoot}/Active`,
    `${settings.projectsRoot}/On Hold`,
    `${settings.areasRoot}/Personal`,
    `${settings.areasRoot}/Professional`,
    `${settings.resourcesRoot}/Reference`,
    `${settings.resourcesRoot}/Learning`,
    `${settings.archivesRoot}/${(/* @__PURE__ */ new Date()).getFullYear()}`
  ];
  for (const folder of subFolders) {
    if (!await app.vault.adapter.exists(folder)) {
      try {
        await app.vault.createFolder(folder);
      } catch (e) {
        console.log(`Could not create folder: ${folder}`);
      }
    }
  }
}
async function createBasesViews(app, settings) {
  if (!settings.useBasesForViews) return;
  const projectsBase = `folder: "${settings.projectsRoot}"
view: table`;
  const projectsBasePath = `${settings.projectsRoot}/projects.base`;
  if (!await app.vault.adapter.exists(projectsBasePath)) {
    await app.vault.create(projectsBasePath, projectsBase);
  }
  const areasBase = `folder: "${settings.areasRoot}"
view: table`;
  const areasBasePath = `${settings.areasRoot}/areas.base`;
  if (!await app.vault.adapter.exists(areasBasePath)) {
    await app.vault.create(areasBasePath, areasBase);
  }
  const inboxBase = `folder: "/"
view: table`;
  const inboxBasePath = `Inbox.base`;
  if (!await app.vault.adapter.exists(inboxBasePath)) {
    await app.vault.create(inboxBasePath, inboxBase);
  }
}
function createProjectTemplate() {
  return `---
para-type: project
status: active
created: ${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}
deadline: 
outcome: 
progress: 0
tags: []
---

# {{title}}

## Outcome
> What does "done" look like?

## Milestones
- [ ] 

## Resources
- 

## Notes

`;
}
function createAreaTemplate() {
  return `---
para-type: area
standard: 
status: active
last-review: ${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}
tags: []
---

# {{title}}

## Standard to Maintain
> What standard are you maintaining?

## Current Projects
- 

## Resources
- 

## Review Notes

`;
}
async function createQuickCapture(app, settings) {
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  const filename = `Capture-${timestamp.split("T")[0]}-${Date.now()}.md`;
  const content = `---
para-type: inbox
created: ${timestamp}
suggested-type: 
notes: 
---

# Quick Capture

## Content

## Next Actions
- [ ] Classify into PARA system
- [ ] Add relevant metadata
- [ ] Link to related notes

`;
  const file = await app.vault.create(filename, content);
  return file;
}
function classifyWithoutAI(content, filename) {
  const lower = content.toLowerCase();
  const hasDeadline = /deadline|due|by|complete by|finish/i.test(content);
  const hasOutcome = /outcome|goal|objective|deliverable|result/i.test(content);
  const hasStandard = /standard|maintain|ongoing|responsibility|regular/i.test(content);
  const isReference = /reference|resource|learning|research|notes|documentation/i.test(content);
  const isComplete = /completed|done|finished|archived/i.test(content);
  if (isComplete) {
    return {
      type: "archive",
      confidence: 0.8,
      reason: "Contains completion markers",
      suggestedMetadata: { status: "archived" }
    };
  }
  if (hasDeadline && hasOutcome) {
    return {
      type: "project",
      confidence: 0.85,
      reason: "Has deadline and outcome",
      suggestedMetadata: { status: "active" }
    };
  }
  if (hasStandard && !hasDeadline) {
    return {
      type: "area",
      confidence: 0.75,
      reason: "Has ongoing standards to maintain",
      suggestedMetadata: { status: "active" }
    };
  }
  if (isReference || filename.includes("resource")) {
    return {
      type: "resource",
      confidence: 0.7,
      reason: "Contains reference material",
      suggestedMetadata: {}
    };
  }
  return {
    type: "resource",
    confidence: 0.4,
    reason: "Could not determine clear category",
    suggestedMetadata: {}
  };
}
var EnhancedPreviewModal = class extends import_obsidian2.Modal {
  constructor(app, originalContent, newContent, proposedChanges, currentPath, newPath, onDecision) {
    super(app);
    this.result = null;
    this.originalContent = originalContent;
    this.newContent = newContent;
    this.proposedChanges = proposedChanges;
    this.currentPath = currentPath;
    this.newPath = newPath;
    this.onDecision = onDecision;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("para-preview-modal");
    contentEl.createEl("h2", { text: "PARA Classification Preview" });
    const summaryDiv = contentEl.createDiv({ cls: "para-summary" });
    summaryDiv.createEl("h3", { text: "Proposed Changes" });
    const summaryList = summaryDiv.createEl("ul");
    summaryList.createEl("li", {
      text: `Bucket: ${this.proposedChanges.bucket} (confidence: ${(this.proposedChanges.confidence * 100).toFixed(0)}%)`
    });
    if (this.currentPath !== this.newPath) {
      const pathItem = summaryList.createEl("li");
      pathItem.createEl("span", { text: "Move: " });
      pathItem.createEl("code", { text: this.currentPath });
      pathItem.createEl("span", { text: " \u2192 " });
      pathItem.createEl("code", { text: this.newPath });
    }
    if (this.proposedChanges.notes) {
      summaryList.createEl("li", { text: `Reason: ${this.proposedChanges.notes}` });
    }
    if (this.proposedChanges.frontmatterUpdates && Object.keys(this.proposedChanges.frontmatterUpdates).length > 0) {
      const fmDiv = contentEl.createDiv({ cls: "para-frontmatter" });
      fmDiv.createEl("h3", { text: "Frontmatter Updates" });
      const fmTable = fmDiv.createEl("table");
      const headerRow = fmTable.createEl("tr");
      headerRow.createEl("th", { text: "Field" });
      headerRow.createEl("th", { text: "Value" });
      for (const [key, value] of Object.entries(this.proposedChanges.frontmatterUpdates)) {
        const row = fmTable.createEl("tr");
        row.createEl("td", { text: key });
        row.createEl("td", { text: String(value) });
      }
    }
    const comparisonDiv = contentEl.createDiv({ cls: "para-comparison" });
    comparisonDiv.createEl("h3", { text: "Content Preview" });
    const compareContainer = comparisonDiv.createDiv({ cls: "para-compare-container" });
    const originalDiv = compareContainer.createDiv({ cls: "para-original" });
    originalDiv.createEl("h4", { text: "Original" });
    const originalPre = originalDiv.createEl("pre");
    originalPre.createEl("code", { text: this.originalContent.slice(0, 500) + (this.originalContent.length > 500 ? "\n..." : "") });
    const newDiv = compareContainer.createDiv({ cls: "para-new" });
    newDiv.createEl("h4", { text: "After Changes" });
    const newPre = newDiv.createEl("pre");
    newPre.createEl("code", { text: this.newContent.slice(0, 500) + (this.newContent.length > 500 ? "\n..." : "") });
    const buttonDiv = contentEl.createDiv({ cls: "para-buttons" });
    new import_obsidian2.ButtonComponent(buttonDiv).setButtonText("Apply Changes").setCta().onClick(() => {
      this.result = "accept";
      this.close();
      this.onDecision(true);
    });
    new import_obsidian2.ButtonComponent(buttonDiv).setButtonText("Cancel").onClick(() => {
      this.result = "cancel";
      this.close();
      this.onDecision(false);
    });
    this.addStyles();
  }
  addStyles() {
    const style = document.createElement("style");
    style.textContent = `
      .para-preview-modal {
        max-width: 90vw;
        max-height: 85vh;
        overflow-y: auto;
      }
      .para-summary ul {
        list-style: none;
        padding-left: 0;
      }
      .para-summary li {
        margin: 8px 0;
        padding: 8px;
        background: var(--background-secondary);
        border-radius: 4px;
      }
      .para-frontmatter table {
        width: 100%;
        border-collapse: collapse;
        margin: 10px 0;
      }
      .para-frontmatter th, .para-frontmatter td {
        padding: 8px;
        text-align: left;
        border: 1px solid var(--background-modifier-border);
      }
      .para-frontmatter th {
        background: var(--background-secondary);
        font-weight: bold;
      }
      .para-compare-container {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
        margin: 20px 0;
      }
      .para-original, .para-new {
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        padding: 10px;
      }
      .para-original h4 {
        color: var(--text-error);
      }
      .para-new h4 {
        color: var(--text-success);
      }
      .para-original pre, .para-new pre {
        max-height: 300px;
        overflow-y: auto;
        background: var(--background-primary);
        padding: 10px;
        border-radius: 4px;
      }
      .para-buttons {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        margin-top: 20px;
        padding-top: 20px;
        border-top: 1px solid var(--background-modifier-border);
      }
    `;
    document.head.appendChild(style);
  }
  onClose() {
    if (this.result === null) {
      this.onDecision(false);
    }
  }
};
var SYSTEM_BASE = `You are "Claude Code for PARA", an expert Obsidian assistant.
- You strictly output JSON only.
- You help classify notes into PARA (Projects, Areas, Resources, Archives), propose metadata updates, safe renames, and concise reasons.
- Follow Tiago Forte's PARA heuristics: Projects are time-bound outcomes; Areas are ongoing responsibilities; Resources are knowledge; Archives are inactive.
- Prefer minimal changes; never invent facts.
- Keep file names tidy (slug-like).`;
function classifyUserPrompt(params) {
  return `You are given an Obsidian note. Decide its best PARA bucket and propose actions.

Return strict JSON with this schema:
{
  "bucket": "Projects" | "Areas" | "Resources" | "Archives",
  "confidence": 0..1,
  "newFileName": "string (no extension, kebab-case recommended)",
  "targetFolder": "string (relative path to the PARA root you choose)",
  "frontmatterUpdates": { "para": "Projects|Areas|Resources|Archives", "status"?: "active|hold|done", "owner"?: "string", "due"?: "YYYY-MM-DD" , "outcome"?: "string", "area"?: "string" },
  "notes": "one-sentence rationale",
  "extractedTasks": [
    {
      "text": "task description without checkbox syntax",
      "priority": "highest|high|medium|low|lowest or null",
      "due": "YYYY-MM-DD or null",
      "scheduled": "YYYY-MM-DD or null", 
      "recurrence": "Tasks plugin format like 'every week' or null",
      "tags": ["#project/example", "#area/work"],
      "context": "brief context from note"
    }
  ]
}

Context:
- Current file name: ${params.fileName}
- Path: ${params.filePath}
- PARA roots: Projects="${params.roots.projects}", Areas="${params.roots.areas}", Resources="${params.roots.resources}", Archives="${params.roots.archives}"

TASK EXTRACTION INSTRUCTIONS:
Identify actionable items that should become tasks. Look for:
- Meeting action items and follow-ups
- "TODO:", "Action:", "Follow up:", "Next:", "Need to:", "Remember to:"
- Bullet points with action verbs (call, email, schedule, review, create, etc.)
- Questions that need research or answers
- Deadlines and time-sensitive items
- Assignments and responsibilities

Format tasks for Obsidian Tasks plugin:
- Extract ONLY the action text (no markdown checkbox syntax)
- Detect priorities from words like "urgent", "ASAP", "important", "when possible"
- Extract dates from text ("by Friday", "next week", "January 15th")
- Add relevant PARA tags (#project/name, #area/work, etc.)
- Provide brief context about where task came from

- File content below (frontmatter + body):
<<<
${params.content.slice(0, 2e4)}
>>>`;
}
function weeklyReviewPrompt(summary) {
  return `You will produce a PARA weekly review plan as compact JSON.

Schema:
{
  "quickWins": string[],               // 3\u20137 actionable fixes (rename/move/add meta)
  "misfiled": { "path": string, "suggestedBucket": string, "why": string }[],
  "staleProjects": { "path": string, "nudge": string }[],
  "archiveCandidates": { "path": string, "why": string }[],
  "mocGaps": { "areaOrResource": string, "addLinks": string[] }[]
}

Vault snapshot for review:
${summary}`;
}
function mocPrompt(topic, files) {
  return `Create a Map of Content (MOC) for "${topic}" as JSON.

Schema:
{
  "title": "string",
  "intro": "2\u20133 sentence purpose",
  "sections": [
    { "heading": "string", "links": [{ "path": "string", "label": "string" }] }
  ],
  "footer": "one-line next step"
}

Candidate files:
${files.map((f) => `- ${f}`).join("\n")}
Guidelines: group by sub-topics or workflows; prefer fewer, clearer sections; labels should be human-friendly.`;
}
async function processBatch(app, files, processor, progressCallback) {
  const results = [];
  for (let i = 0; i < files.length; i++) {
    if (progressCallback) {
      progressCallback(i + 1, files.length);
    }
    try {
      const result = await processor(files[i]);
      results.push(result);
    } catch (e) {
      results.push({
        path: files[i].path,
        success: false,
        error: e.message
      });
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return results;
}
var ParaClaudePlugin = class extends import_obsidian2.Plugin {
  constructor() {
    super(...arguments);
    this.settings = DEFAULTS;
    this.operationHistory = new OperationHistory();
  }
  async onload() {
    await this.loadSettings();
    this.addStyles();
    this.registerView(
      PARA_SIDEBAR_VIEW_TYPE,
      (leaf) => new ParaSidebarView(leaf, this)
    );
    if (this.settings.autoCreateStructure) {
      await ensureParaStructure(this.app, this.settings);
      await createBasesViews(this.app, this.settings);
    }
    this.initializeSidebar();
    this.addCommand({
      id: "para-setup-structure",
      name: "PARA: Setup Folder Structure",
      callback: async () => {
        await ensureParaStructure(this.app, this.settings);
        await createBasesViews(this.app, this.settings);
        new import_obsidian2.Notice("PARA structure created successfully!");
      }
    });
    this.addCommand({
      id: "para-refresh-bases",
      name: "PARA: Refresh/Recreate Base Views",
      callback: async () => {
        const basePaths = [
          `${this.settings.projectsRoot}/projects.base`,
          `${this.settings.areasRoot}/areas.base`,
          `Inbox.base`
        ];
        for (const path of basePaths) {
          const file = this.app.vault.getAbstractFileByPath(path);
          if (file) {
            await this.app.vault.delete(file);
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
        await createBasesViews(this.app, this.settings);
        this.app.workspace.trigger("layout-change");
        new import_obsidian2.Notice("Base views refreshed! You may need to reopen them.");
      }
    });
    this.addCommand({
      id: "para-quick-capture",
      name: "PARA: Quick Capture",
      callback: async () => {
        if (this.settings.enableQuickCapture) {
          const file = await createQuickCapture(this.app, this.settings);
          await this.app.workspace.getLeaf(false).openFile(file);
          new import_obsidian2.Notice("Quick capture created!");
        } else {
          new import_obsidian2.Notice("Quick capture is disabled in settings");
        }
      }
    });
    this.addCommand({
      id: "para-new-project",
      name: "PARA: New Project",
      callback: () => this.createNewProject()
    });
    this.addCommand({
      id: "para-new-area",
      name: "PARA: New Area",
      callback: () => this.createNewArea()
    });
    this.addCommand({
      id: "para-classify-move",
      name: "PARA: Classify & Move Current Note (Claude)",
      callback: () => this.classifyAndMove()
    });
    this.addCommand({
      id: "para-classify-simple",
      name: "PARA: Quick Classify (No AI)",
      callback: () => this.quickClassify()
    });
    this.addCommand({
      id: "para-classify-batch",
      name: "PARA: Batch Classify Selected Notes (Claude)",
      callback: () => this.batchClassify()
    });
    this.addCommand({
      id: "para-weekly-review",
      name: "PARA: Weekly Review (Claude)",
      callback: () => this.weeklyReview()
    });
    this.addCommand({
      id: "para-project-review",
      name: "PARA: Review Projects",
      callback: () => this.reviewProjects()
    });
    this.addCommand({
      id: "para-archive-completed",
      name: "PARA: Archive Completed Projects",
      callback: () => this.archiveCompletedProjects()
    });
    this.addCommand({
      id: "para-generate-moc",
      name: "PARA: Generate MOC for Area/Resource (Claude)",
      callback: () => this.generateMOC()
    });
    this.addCommand({
      id: "para-create-dataview-dashboard",
      name: "PARA: Create Analytics Dashboard (Dataview)",
      callback: () => this.createDataviewDashboard()
    });
    this.addCommand({
      id: "para-undo-last",
      name: "PARA: Undo Last Operation",
      callback: () => this.undoLastOperation()
    });
    this.addCommand({
      id: "para-show-history",
      name: "PARA: Show Operation History",
      callback: () => this.showHistory()
    });
    this.addCommand({
      id: "para-test-api",
      name: "PARA: Test Claude API Connection",
      callback: () => this.testApiConnection()
    });
    this.addCommand({
      id: "para-toggle-sidebar",
      name: "PARA: Toggle Sidebar",
      callback: () => this.toggleSidebar()
    });
    this.addCommand({
      id: "para-refresh-sidebar",
      name: "PARA: Refresh Sidebar",
      callback: () => this.refreshSidebar()
    });
    this.addCommand({
      id: "para-create-tasks-dashboard",
      name: "PARA: Create Tasks Dashboard",
      callback: () => this.createTasksDashboard()
    });
    this.addCommand({
      id: "para-extract-tasks-current",
      name: "PARA: Extract Tasks from Current Note",
      callback: () => this.extractTasksFromCurrentNote()
    });
    this.addSettingTab(new ParaClaudeSettingTab(this.app, this));
    this.registerEvent(
      this.app.workspace.on("file-open", (file) => {
        if (file && this.settings.projectDeadlineWarningDays > 0) {
          this.checkProjectDeadlines();
        }
      })
    );
    new import_obsidian2.Notice("PARA Assistant loaded - Hybrid Bases/Dataview mode!");
  }
  async initializeSidebar() {
    this.app.workspace.onLayoutReady(() => {
      this.openSidebar();
    });
  }
  async openSidebar() {
    const existing = this.app.workspace.getLeavesOfType(PARA_SIDEBAR_VIEW_TYPE);
    if (existing.length === 0) {
      const rightLeaf = this.app.workspace.getRightLeaf(false);
      if (rightLeaf) {
        await rightLeaf.setViewState({
          type: PARA_SIDEBAR_VIEW_TYPE,
          active: true
        });
        this.app.workspace.revealLeaf(rightLeaf);
      }
    }
  }
  async toggleSidebar() {
    const existing = this.app.workspace.getLeavesOfType(PARA_SIDEBAR_VIEW_TYPE);
    if (existing.length > 0) {
      existing[0].detach();
    } else {
      await this.openSidebar();
    }
  }
  async refreshSidebar() {
    const existing = this.app.workspace.getLeavesOfType(PARA_SIDEBAR_VIEW_TYPE);
    if (existing.length > 0) {
      const view = existing[0].view;
      await view.refresh();
    }
  }
  async createTasksDashboard() {
    await createTasksDashboard(this.app, this.settings);
  }
  async extractTasksFromCurrentNote() {
    const view = this.app.workspace.getActiveViewOfType(import_obsidian2.MarkdownView);
    if (!view?.file) {
      new import_obsidian2.Notice("Open a note first.");
      return;
    }
    const file = view.file;
    const content = await this.app.vault.read(file);
    const prompt = classifyUserPrompt({
      fileName: file.basename,
      filePath: file.path,
      content,
      roots: {
        projects: this.settings.projectsRoot,
        areas: this.settings.areasRoot,
        resources: this.settings.resourcesRoot,
        archives: this.settings.archivesRoot
      }
    });
    try {
      const result = await callClaudeJSON(this.settings, SYSTEM_BASE, prompt);
      if (result.extractedTasks && result.extractedTasks.length > 0) {
        await createTasksFromClassification(this.app, file, result.extractedTasks, this.settings);
        new import_obsidian2.Notice(`Extracted ${result.extractedTasks.length} task(s) from ${file.basename}`);
      } else {
        new import_obsidian2.Notice("No actionable tasks found in current note.");
      }
    } catch (e) {
      new import_obsidian2.Notice(`Error extracting tasks: ${e.message}`, 8e3);
    }
  }
  onunload() {
    const existingStyle = document.getElementById("para-sidebar-styles");
    if (existingStyle) {
      existingStyle.remove();
    }
  }
  addStyles() {
    const style = document.createElement("style");
    style.id = "para-sidebar-styles";
    style.textContent = `
      .para-sidebar-container {
        padding: 8px;
        height: 100%;
        overflow-y: auto;
        font-size: var(--font-ui-smaller);
      }
      .para-section {
        margin-bottom: 16px;
        border-radius: 6px;
        background: var(--background-secondary);
        border: 1px solid var(--background-modifier-border);
      }
      .para-section-header {
        display: flex;
        align-items: center;
        padding: 12px;
        cursor: pointer;
        border-bottom: 1px solid var(--background-modifier-border);
        background: var(--background-secondary);
        border-radius: 6px 6px 0 0;
      }
      .para-section-header:hover {
        background: var(--background-modifier-hover);
      }
      .para-section-icon {
        margin-right: 8px;
        color: var(--text-muted);
        flex-shrink: 0;
      }
      .para-collapse-icon {
        margin-right: 6px;
        color: var(--text-muted);
        flex-shrink: 0;
        transition: transform 0.2s;
      }
      .para-title-container {
        display: flex;
        align-items: center;
        flex: 1;
      }
      .para-section-title {
        margin: 0;
        font-size: var(--font-ui-small);
        font-weight: var(--font-weight);
        color: var(--text-normal);
        flex: 1;
      }
      .para-section-content {
        padding: 12px;
        max-height: 400px;
        overflow-y: auto;
      }
      .para-section-content.para-collapsed {
        display: none;
      }
      .para-dashboard {
        background: var(--background-primary);
        border: 1px solid var(--color-accent);
      }
      .para-stats-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        margin-bottom: 12px;
      }
      .para-stat-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 8px;
        background: var(--background-secondary);
        border-radius: 4px;
        border: 1px solid var(--background-modifier-border);
      }
      .para-stat-icon {
        color: var(--color-accent);
        margin-bottom: 4px;
      }
      .para-stat-number {
        font-size: 18px;
        font-weight: var(--font-bold);
        color: var(--text-normal);
        line-height: 1;
      }
      .para-stat-label {
        font-size: var(--font-ui-smallest);
        color: var(--text-muted);
        margin-top: 2px;
      }
      .para-alert {
        padding: 8px;
        border-radius: 4px;
        margin: 8px 0;
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: var(--font-ui-smaller);
      }
      .para-alert-warning {
        background: var(--background-modifier-error-hover);
        border: 1px solid var(--background-modifier-error);
        color: var(--text-error);
      }
      .para-quick-actions {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .para-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        border-radius: 4px;
        border: 1px solid var(--background-modifier-border);
        background: var(--background-primary);
        color: var(--text-normal);
        cursor: pointer;
        font-size: var(--font-ui-smaller);
        transition: all 0.15s;
        text-align: left;
        justify-content: flex-start;
      }
      .para-btn:hover {
        background: var(--background-modifier-hover);
        border-color: var(--background-modifier-border-hover);
      }
      .para-btn-primary {
        background: var(--color-accent);
        color: var(--text-on-accent);
        border-color: var(--color-accent);
      }
      .para-btn-primary:hover {
        background: var(--color-accent-hover);
        border-color: var(--color-accent-hover);
      }
      .para-btn-ghost {
        background: transparent;
        border-color: transparent;
      }
      .para-btn-ghost:hover {
        background: var(--background-modifier-hover);
      }
      .para-btn-action {
        justify-content: center;
        padding: 8px;
        width: 100%;
      }
      .para-btn-operation {
        justify-content: flex-start;
        padding: 8px 12px;
        width: 100%;
        margin-bottom: 4px;
      }
      .para-btn-tool {
        padding: 4px 8px;
      }
      .para-btn-sm {
        padding: 4px 8px;
        font-size: var(--font-ui-smallest);
      }
      .para-btn-xs {
        padding: 2px 4px;
        font-size: var(--font-ui-smallest);
      }
      .para-badge {
        background: var(--background-modifier-border);
        color: var(--text-muted);
        padding: 2px 6px;
        border-radius: 10px;
        font-size: var(--font-ui-smallest);
        font-weight: var(--font-medium);
        margin-left: 8px;
      }
      .para-badge-warning {
        background: var(--color-orange);
        color: var(--text-on-accent);
      }
      .para-badge-danger {
        background: var(--color-red);
        color: var(--text-on-accent);
      }
      .para-project-card, .para-area-card {
        background: var(--background-primary);
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        padding: 8px;
        margin-bottom: 6px;
      }
      .para-project-card:hover, .para-area-card:hover {
        border-color: var(--background-modifier-border-hover);
        background: var(--background-modifier-hover);
      }
      .para-card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 6px;
      }
      .para-card-title {
        flex: 1;
        font-weight: var(--font-medium);
      }
      .para-link {
        color: var(--text-normal);
        text-decoration: none;
        cursor: pointer;
      }
      .para-link:hover {
        color: var(--color-accent);
        text-decoration: underline;
      }
      .para-status {
        padding: 2px 6px;
        border-radius: 3px;
        font-size: var(--font-ui-smallest);
        font-weight: var(--font-medium);
        text-transform: uppercase;
      }
      .para-status-active {
        background: var(--color-green);
        color: white;
      }
      .para-status-hold {
        background: var(--color-orange);
        color: white;
      }
      .para-status-blocked {
        background: var(--color-red);
        color: white;
      }
      .para-status-completed {
        background: var(--text-muted);
        color: white;
      }
      .para-card-details {
        font-size: var(--font-ui-smallest);
        color: var(--text-muted);
        margin-bottom: 6px;
      }
      .para-deadline {
        display: flex;
        align-items: center;
        gap: 4px;
        margin-bottom: 4px;
      }
      .para-overdue {
        color: var(--color-red) !important;
      }
      .para-due-soon {
        color: var(--color-orange) !important;
      }
      .para-progress {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .para-progress-bar {
        flex: 1;
        height: 4px;
        background: var(--background-modifier-border);
        border-radius: 2px;
        overflow: hidden;
      }
      .para-progress-fill {
        height: 100%;
        background: var(--color-accent);
        transition: width 0.3s;
      }
      .para-progress-text {
        font-size: var(--font-ui-smallest);
        color: var(--text-muted);
        min-width: 30px;
        text-align: right;
      }
      .para-card-actions {
        display: flex;
        gap: 4px;
        justify-content: flex-end;
      }
      .para-health-indicator {
        margin-left: 8px;
      }
      .para-healthy {
        color: var(--color-green);
      }
      .para-needs-attention {
        color: var(--color-orange);
      }
      .para-area-standard {
        font-size: var(--font-ui-smallest);
        color: var(--text-muted);
        margin-bottom: 4px;
        font-style: italic;
      }
      .para-area-review {
        font-size: var(--font-ui-smallest);
        color: var(--text-muted);
      }
      .para-inbox-alert {
        background: var(--background-modifier-error-hover);
        border: 1px solid var(--background-modifier-error);
        border-radius: 4px;
        padding: 8px;
        margin-bottom: 8px;
      }
      .para-inbox-count {
        color: var(--text-error);
        font-weight: var(--font-medium);
        margin-bottom: 6px;
      }
      .para-inbox-actions {
        display: flex;
        gap: 6px;
      }
      .para-recent-list {
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .para-recent-list li {
        padding: 2px 0;
      }
      .para-operations-grid {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .para-plugin-status {
        margin-bottom: 12px;
        padding: 6px;
        background: var(--background-modifier-border);
        border-radius: 4px;
        font-size: var(--font-ui-smallest);
      }
      .para-status-good {
        color: var(--color-green);
      }
      .para-status-warning {
        color: var(--color-orange);
      }
      .para-toggle {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 6px;
        font-size: var(--font-ui-smaller);
        cursor: pointer;
      }
      .para-toggle input[type="checkbox"] {
        margin: 0;
      }
      .para-tools-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
      }
      .para-empty-state {
        text-align: center;
        color: var(--text-muted);
        font-size: var(--font-ui-smaller);
        padding: 16px 8px;
        font-style: italic;
      }
      .para-success-state {
        color: var(--color-green);
        font-weight: var(--font-medium);
        font-style: normal;
      }
      .para-task-stats {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 4px;
        margin-bottom: 8px;
      }
      .para-task-stat-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 6px 4px;
        background: var(--background-secondary);
        border-radius: 4px;
        border: 1px solid var(--background-modifier-border);
      }
      .para-task-stat-icon {
        color: var(--color-accent);
        margin-bottom: 2px;
      }
      .para-task-stat-number {
        font-size: 14px;
        font-weight: var(--font-bold);
        color: var(--text-normal);
        line-height: 1;
      }
      .para-task-stat-label {
        font-size: var(--font-ui-smallest);
        color: var(--text-muted);
        margin-top: 2px;
      }
      .para-task-actions {
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin-bottom: 8px;
      }
      .para-btn-task {
        justify-content: flex-start;
        padding: 6px 8px;
        width: 100%;
        font-size: var(--font-ui-smaller);
      }
      .para-tasks-note {
        font-size: var(--font-ui-smallest);
        color: var(--text-muted);
        font-style: italic;
        text-align: center;
        padding: 4px;
        background: var(--background-modifier-border);
        border-radius: 3px;
      }
    `;
    document.head.appendChild(style);
  }
  /** ------- Commands ------- */
  async classifyAndMove() {
    const view = this.app.workspace.getActiveViewOfType(import_obsidian2.MarkdownView);
    if (!view?.file) {
      new import_obsidian2.Notice("Open a note first.");
      return;
    }
    const file = view.file;
    const originalContent = await this.app.vault.read(file);
    let backupPath = null;
    if (this.settings.autoBackup) {
      try {
        backupPath = await createBackup(this.app, file);
      } catch (e) {
        console.error("Backup failed:", e);
      }
    }
    if (this.settings.showCostEstimate) {
      const promptText = classifyUserPrompt({
        fileName: file.basename,
        filePath: file.path,
        content: originalContent,
        roots: {
          projects: this.settings.projectsRoot,
          areas: this.settings.areasRoot,
          resources: this.settings.resourcesRoot,
          archives: this.settings.archivesRoot
        }
      });
      const inputTokens = estimateTokens(SYSTEM_BASE + promptText);
      const outputTokens = estimateTokens(JSON.stringify({
        bucket: "Example",
        confidence: 0.8,
        newFileName: "example-file",
        targetFolder: "path/to/folder",
        frontmatterUpdates: {},
        notes: "Example note"
      }));
      const cost = estimateApiCost(inputTokens, outputTokens, this.settings.anthropicModel);
      new import_obsidian2.Notice(`Estimated API cost: $${cost.toFixed(4)}`, 3e3);
    }
    const prompt = classifyUserPrompt({
      fileName: file.basename,
      filePath: file.path,
      content: originalContent,
      roots: {
        projects: this.settings.projectsRoot,
        areas: this.settings.areasRoot,
        resources: this.settings.resourcesRoot,
        archives: this.settings.archivesRoot
      }
    });
    let result;
    try {
      result = await callClaudeJSON(this.settings, SYSTEM_BASE, prompt);
    } catch (e) {
      new import_obsidian2.Notice(`API Error: ${e.message}`, 8e3);
      return;
    }
    const { yaml, body, hasFM } = ensureFrontmatter(originalContent);
    const updatedYaml = mergeFrontmatter(yaml, { para: result.bucket, ...result.frontmatterUpdates });
    const newContent = `---
${updatedYaml}
---

${body}`;
    const newBase = result.newFileName?.trim() || file.basename;
    const targetFolder = result.targetFolder?.trim() || this.settings.resourcesRoot;
    const newPath = `${targetFolder}/${newBase}.md`;
    const modal = new EnhancedPreviewModal(
      this.app,
      originalContent,
      newContent,
      result,
      file.path,
      newPath,
      async (accepted) => {
        if (accepted && !this.settings.dryRun) {
          try {
            const operationId = `op-${Date.now()}`;
            if (originalContent !== newContent) {
              await this.app.vault.modify(file, newContent);
              this.operationHistory.add({
                id: operationId,
                timestamp: Date.now(),
                type: "modify",
                originalPath: file.path,
                originalContent,
                newContent,
                description: `Modified frontmatter for ${file.basename}`
              });
            }
            if (file.path !== newPath) {
              const dir = newPath.split("/").slice(0, -1).join("/");
              if (dir && !await this.app.vault.adapter.exists(dir)) {
                await this.app.vault.createFolder(dir);
              }
              await this.app.fileManager.renameFile(file, newPath);
              this.operationHistory.add({
                id: `${operationId}-move`,
                timestamp: Date.now(),
                type: "move",
                originalPath: file.path,
                newPath,
                description: `Moved ${file.basename} to ${newPath}`
              });
            }
            new import_obsidian2.Notice(`\u2705 PARA classification applied${backupPath ? ` (backup: ${backupPath})` : ""}`);
          } catch (e) {
            new import_obsidian2.Notice(`\u274C Error applying changes: ${e.message}`, 8e3);
          }
        } else if (accepted && this.settings.dryRun) {
          new import_obsidian2.Notice("Dry run mode - no changes were made. Disable dry run in settings to apply changes.");
        } else {
          new import_obsidian2.Notice("Classification cancelled.");
        }
      }
    );
    modal.open();
  }
  async batchClassify() {
    const modal = new import_obsidian2.Modal(this.app);
    modal.contentEl.createEl("h2", { text: "Batch Classification" });
    modal.contentEl.createEl("p", { text: "Choose which files to classify:" });
    const buttonDiv = modal.contentEl.createDiv({ cls: "batch-classify-options" });
    buttonDiv.style.display = "flex";
    buttonDiv.style.flexDirection = "column";
    buttonDiv.style.gap = "10px";
    new import_obsidian2.ButtonComponent(buttonDiv).setButtonText("Files in Current Folder").onClick(async () => {
      modal.close();
      await this.batchClassifyFolder();
    });
    new import_obsidian2.ButtonComponent(buttonDiv).setButtonText("All Unclassified Files").onClick(async () => {
      modal.close();
      await this.batchClassifyUntagged();
    });
    new import_obsidian2.ButtonComponent(buttonDiv).setButtonText("Recent Files (Last 7 Days)").onClick(async () => {
      modal.close();
      await this.batchClassifyRecent();
    });
    new import_obsidian2.ButtonComponent(buttonDiv).setButtonText("Cancel").onClick(() => modal.close());
    modal.open();
  }
  async batchClassifyFolder() {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) {
      new import_obsidian2.Notice("Open a file first to classify its folder");
      return;
    }
    const folder = activeFile.parent?.path || "";
    const files = this.app.vault.getMarkdownFiles().filter((f) => f.parent?.path === folder);
    if (files.length === 0) {
      new import_obsidian2.Notice("No files found in current folder");
      return;
    }
    await this.processBatchClassification(files, `folder: ${folder}`);
  }
  async batchClassifyUntagged() {
    const files = this.app.vault.getMarkdownFiles().filter((f) => {
      const cache = this.app.metadataCache.getFileCache(f);
      return !cache?.frontmatter?.["para-type"];
    });
    if (files.length === 0) {
      new import_obsidian2.Notice("No unclassified files found");
      return;
    }
    await this.processBatchClassification(files, "unclassified files");
  }
  async batchClassifyRecent() {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1e3;
    const files = this.app.vault.getMarkdownFiles().filter((f) => f.stat.mtime > sevenDaysAgo);
    if (files.length === 0) {
      new import_obsidian2.Notice("No recent files found");
      return;
    }
    await this.processBatchClassification(files, "recent files");
  }
  async processBatchClassification(files, description) {
    const confirmModal = new import_obsidian2.Modal(this.app);
    confirmModal.contentEl.createEl("h2", { text: "Batch Classification" });
    confirmModal.contentEl.createEl("p", {
      text: `Process ${files.length} ${description}? This will classify each according to PARA.`
    });
    const buttonDiv = confirmModal.contentEl.createDiv();
    new import_obsidian2.ButtonComponent(buttonDiv).setButtonText("Process").setCta().onClick(async () => {
      confirmModal.close();
      const progressNotice = new import_obsidian2.Notice(`Processing 0/${files.length} files...`, 0);
      const results = await processBatch(
        this.app,
        files,
        async (file) => {
          try {
            const content = await this.app.vault.read(file);
            const prompt = classifyUserPrompt({
              fileName: file.basename,
              filePath: file.path,
              content,
              roots: {
                projects: this.settings.projectsRoot,
                areas: this.settings.areasRoot,
                resources: this.settings.resourcesRoot,
                archives: this.settings.archivesRoot
              }
            });
            const result = await callClaudeJSON(this.settings, SYSTEM_BASE, prompt);
            if (!this.settings.dryRun) {
              const { yaml, body } = ensureFrontmatter(content);
              const updatedYaml = mergeFrontmatter(yaml, { para: result.bucket, ...result.frontmatterUpdates });
              let newContent = `---
${updatedYaml}
---

${body}`;
              await this.app.vault.modify(file, newContent);
              if (result.extractedTasks && result.extractedTasks.length > 0) {
                await createTasksFromClassification(this.app, file, result.extractedTasks, this.settings);
              }
            }
            return {
              path: file.path,
              success: true,
              changes: result,
              tasksExtracted: result.extractedTasks ? result.extractedTasks.length : 0
            };
          } catch (e) {
            return {
              path: file.path,
              success: false,
              error: e.message
            };
          }
        },
        (current, total) => {
          progressNotice.setMessage(`Processing ${current}/${total} files...`);
        }
      );
      progressNotice.hide();
      const successCount = results.filter((r) => r.success).length;
      const totalTasks = results.reduce((sum, r) => sum + (r.tasksExtracted || 0), 0);
      const taskMsg = totalTasks > 0 ? ` + ${totalTasks} tasks extracted` : "";
      new import_obsidian2.Notice(`Batch complete: ${successCount}/${files.length} files processed${taskMsg}.`, 5e3);
      const report = [
        "# Batch Classification Report",
        `Date: ${(/* @__PURE__ */ new Date()).toISOString()}`,
        `Total files: ${files.length}`,
        `Successful: ${successCount}`,
        "",
        "## Results",
        ...results.map((r) => {
          if (r.success) {
            const taskInfo = r.tasksExtracted > 0 ? ` [+${r.tasksExtracted} tasks]` : "";
            return `\u2705 ${r.path} \u2192 ${r.changes?.bucket || "Unknown"}${taskInfo}`;
          } else {
            return `\u274C ${r.path}: ${r.error}`;
          }
        })
      ].join("\n");
      const reportPath = `${this.settings.areasRoot}/Reports/batch-classification-${Date.now()}.md`;
      await this.app.vault.create(reportPath, report);
    });
    new import_obsidian2.ButtonComponent(buttonDiv).setButtonText("Cancel").onClick(() => confirmModal.close());
    confirmModal.open();
  }
  async weeklyReview() {
    const files = this.app.vault.getMarkdownFiles();
    const rows = [];
    for (const f of files.slice(0, 800)) {
      const meta = this.app.metadataCache.getFileCache(f);
      const para = meta?.frontmatter?.para ?? "";
      const status = meta?.frontmatter?.status ?? "";
      rows.push(`${f.path} | para=${para} | status=${status}`);
    }
    const prompt = weeklyReviewPrompt(rows.join("\n"));
    let result;
    try {
      result = await callClaudeJSON(this.settings, SYSTEM_BASE, prompt);
    } catch (e) {
      new import_obsidian2.Notice(`API Error: ${e.message}`, 8e3);
      return;
    }
    const report = [
      "# PARA Weekly Review (Claude)",
      `Date: ${(/* @__PURE__ */ new Date()).toLocaleDateString()}`,
      "",
      "## Quick wins",
      ...(result.quickWins ?? []).map((x) => `- [ ] ${x}`),
      "",
      "## Misfiled",
      ...(result.misfiled ?? []).map((m) => `- [ ] [[${m.path}]] \u2192 ${m.suggestedBucket} (${m.why})`),
      "",
      "## Stale projects",
      ...(result.staleProjects ?? []).map((p) => `- [ ] [[${p.path}]]: ${p.nudge}`),
      "",
      "## Archive candidates",
      ...(result.archiveCandidates ?? []).map((a) => `- [ ] [[${a.path}]]: ${a.why}`),
      "",
      "## MOC gaps",
      ...(result.mocGaps ?? []).map((g) => `- [ ] ${g.areaOrResource}: add ${g.addLinks?.length ?? 0} links`)
    ].join("\n");
    const reviewDir = `${this.settings.areasRoot}/Reviews`;
    if (!await this.app.vault.adapter.exists(reviewDir)) {
      await this.app.vault.createFolder(reviewDir);
    }
    const file = await this.app.vault.create(
      `${reviewDir}/para-weekly-${Date.now()}.md`,
      report
    );
    await this.app.workspace.getLeaf(true).openFile(file);
    new import_obsidian2.Notice("Weekly review generated!");
  }
  async generateMOC() {
    const topic = await promptUser(this.app, "MOC topic (Area/Resource name)");
    if (!topic) return;
    const candidates = this.app.vault.getMarkdownFiles().filter((f) => f.path.startsWith(this.settings.areasRoot) || f.path.startsWith(this.settings.resourcesRoot)).filter((f) => f.path.toLowerCase().includes(topic.toLowerCase())).slice(0, 200).map((f) => f.path);
    if (candidates.length === 0) {
      new import_obsidian2.Notice(`No files found related to "${topic}"`);
      return;
    }
    let result;
    try {
      result = await callClaudeJSON(this.settings, SYSTEM_BASE, mocPrompt(topic, candidates));
    } catch (e) {
      new import_obsidian2.Notice(`API Error: ${e.message}`, 8e3);
      return;
    }
    const lines = [];
    lines.push(`---
para: "Areas"
type: "MOC"
topic: "${result.title || topic}"
created: ${(/* @__PURE__ */ new Date()).toISOString()}
---
`);
    lines.push(`# ${result.title || topic}
`);
    if (result.intro) lines.push(result.intro + "\n");
    for (const s of result.sections ?? []) {
      lines.push(`## ${s.heading}`);
      for (const l of s.links ?? []) {
        lines.push(`- [[${l.path}|${l.label}]]`);
      }
      lines.push("");
    }
    if (result.footer) lines.push(`---

> ${result.footer}`);
    const mocPath = `${this.settings.areasRoot}/${topic}/_MOC ${topic}.md`;
    const dir = mocPath.split("/").slice(0, -1).join("/");
    if (!await this.app.vault.adapter.exists(dir)) await this.app.vault.createFolder(dir);
    const file = await this.app.vault.create(mocPath, lines.join("\n"));
    await this.app.workspace.getLeaf(true).openFile(file);
    new import_obsidian2.Notice(`MOC created with ${candidates.length} candidate files!`);
  }
  async undoLastOperation() {
    const success = await this.operationHistory.undo(this.app);
    if (success) {
      new import_obsidian2.Notice("\u2705 Last operation undone");
    } else {
      new import_obsidian2.Notice("No operations to undo");
    }
  }
  async showHistory() {
    const history = this.operationHistory.getHistory();
    if (history.length === 0) {
      new import_obsidian2.Notice("No operation history");
      return;
    }
    const modal = new import_obsidian2.Modal(this.app);
    modal.contentEl.createEl("h2", { text: "Operation History" });
    const list = modal.contentEl.createEl("ul");
    for (const op of history.slice(0, 10)) {
      const item = list.createEl("li");
      const time = new Date(op.timestamp).toLocaleString();
      item.createEl("strong", { text: `${op.description}` });
      item.createEl("br");
      item.createEl("small", { text: `${time} (${op.type})` });
    }
    modal.open();
  }
  async createNewProject() {
    const title = await promptUser(this.app, "Project Name");
    if (!title) return;
    const deadline = await promptUser(this.app, "Deadline (YYYY-MM-DD) - optional");
    const outcome = await promptUser(this.app, "What does 'done' look like?");
    const template = createProjectTemplate();
    const content = template.replace("{{title}}", title).replace("deadline: ", deadline ? `deadline: ${deadline}` : "deadline: ").replace("outcome: ", outcome ? `outcome: ${outcome}` : "outcome: ");
    const filename = `${title.replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").toLowerCase()}.md`;
    const filepath = `${this.settings.projectsRoot}/Active/${filename}`;
    const file = await this.app.vault.create(filepath, content);
    await this.app.metadataCache.trigger("changed", file);
    this.app.workspace.trigger("layout-change");
    await this.app.workspace.getLeaf(false).openFile(file);
    new import_obsidian2.Notice(`Project "${title}" created! Base views should update shortly.`);
  }
  async createNewArea() {
    const title = await promptUser(this.app, "Area Name");
    if (!title) return;
    const standard = await promptUser(this.app, "What standard are you maintaining?");
    const template = createAreaTemplate();
    const content = template.replace("{{title}}", title).replace("standard: ", standard ? `standard: ${standard}` : "standard: ");
    const filename = `${title.replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").toLowerCase()}.md`;
    const filepath = `${this.settings.areasRoot}/${filename}`;
    const file = await this.app.vault.create(filepath, content);
    await this.app.workspace.getLeaf(false).openFile(file);
    new import_obsidian2.Notice(`Area "${title}" created!`);
  }
  async quickClassify() {
    const view = this.app.workspace.getActiveViewOfType(import_obsidian2.MarkdownView);
    if (!view?.file) {
      new import_obsidian2.Notice("Open a note first.");
      return;
    }
    const file = view.file;
    const content = await this.app.vault.read(file);
    const classification = classifyWithoutAI(content, file.basename);
    const { yaml, body } = ensureFrontmatter(content);
    const updatedYaml = mergeFrontmatter(yaml, {
      "para-type": classification.type,
      ...classification.suggestedMetadata
    });
    const newContent = `---
${updatedYaml}
---

${body}`;
    const modal = new import_obsidian2.Modal(this.app);
    modal.contentEl.createEl("h2", { text: "Quick Classification" });
    modal.contentEl.createEl("p", {
      text: `Type: ${classification.type} (${(classification.confidence * 100).toFixed(0)}% confidence)`
    });
    modal.contentEl.createEl("p", { text: `Reason: ${classification.reason}` });
    const buttonDiv = modal.contentEl.createDiv();
    new import_obsidian2.ButtonComponent(buttonDiv).setButtonText("Apply").setCta().onClick(async () => {
      await this.app.vault.modify(file, newContent);
      modal.close();
      new import_obsidian2.Notice("Classification applied!");
    });
    new import_obsidian2.ButtonComponent(buttonDiv).setButtonText("Cancel").onClick(() => modal.close());
    modal.open();
  }
  async reviewProjects() {
    const projects = this.app.vault.getMarkdownFiles().filter((f) => f.path.startsWith(this.settings.projectsRoot));
    const projectData = [];
    for (const file2 of projects) {
      const cache = this.app.metadataCache.getFileCache(file2);
      const fm = cache?.frontmatter;
      if (fm?.["para-type"] === "project" && fm?.status !== "archived") {
        projectData.push({
          file: file2,
          name: file2.basename,
          status: fm.status || "unknown",
          deadline: fm.deadline || "none",
          progress: fm.progress || 0,
          created: fm.created || "unknown"
        });
      }
    }
    projectData.sort((a, b) => {
      if (a.deadline === "none") return 1;
      if (b.deadline === "none") return -1;
      return a.deadline.localeCompare(b.deadline);
    });
    const report = [
      "# Project Review",
      `Date: ${(/* @__PURE__ */ new Date()).toLocaleDateString()}`,
      `Active Projects: ${projectData.length}`,
      "",
      "## Projects by Deadline",
      ...projectData.map((p) => {
        const deadlineWarning = this.isDeadlineNear(p.deadline) ? " \u26A0\uFE0F" : "";
        return `- [[${p.file.path}|${p.name}]] - Deadline: ${p.deadline}${deadlineWarning} - Progress: ${p.progress}%`;
      }),
      "",
      "## Action Items",
      "- [ ] Review stalled projects",
      "- [ ] Update project progress",
      "- [ ] Archive completed projects",
      "- [ ] Clarify outcomes for vague projects"
    ].join("\n");
    const reviewPath = `${this.settings.areasRoot}/Reviews/project-review-${Date.now()}.md`;
    const file = await this.app.vault.create(reviewPath, report);
    await this.app.workspace.getLeaf(true).openFile(file);
    new import_obsidian2.Notice("Project review created!");
  }
  async archiveCompletedProjects() {
    if (!this.settings.archiveCompletedProjects) {
      new import_obsidian2.Notice("Auto-archive is disabled in settings");
      return;
    }
    const projects = this.app.vault.getMarkdownFiles().filter((f) => f.path.startsWith(this.settings.projectsRoot));
    const toArchive = [];
    for (const file of projects) {
      const cache = this.app.metadataCache.getFileCache(file);
      const fm = cache?.frontmatter;
      if (fm?.status === "completed" || fm?.status === "done") {
        toArchive.push(file);
      }
    }
    if (toArchive.length === 0) {
      new import_obsidian2.Notice("No completed projects to archive");
      return;
    }
    const modal = new import_obsidian2.Modal(this.app);
    modal.contentEl.createEl("h2", { text: "Archive Completed Projects" });
    modal.contentEl.createEl("p", {
      text: `Found ${toArchive.length} completed project(s) to archive:`
    });
    const list = modal.contentEl.createEl("ul");
    for (const file of toArchive) {
      list.createEl("li", { text: file.basename });
    }
    const buttonDiv = modal.contentEl.createDiv();
    new import_obsidian2.ButtonComponent(buttonDiv).setButtonText("Archive All").setCta().onClick(async () => {
      modal.close();
      const year = (/* @__PURE__ */ new Date()).getFullYear();
      const archiveFolder = `${this.settings.archivesRoot}/${year}/Projects`;
      if (!await this.app.vault.adapter.exists(archiveFolder)) {
        await this.app.vault.createFolder(archiveFolder);
      }
      for (const file of toArchive) {
        const newPath = `${archiveFolder}/${file.name}`;
        await this.app.fileManager.renameFile(file, newPath);
      }
      new import_obsidian2.Notice(`Archived ${toArchive.length} project(s)`);
    });
    new import_obsidian2.ButtonComponent(buttonDiv).setButtonText("Cancel").onClick(() => modal.close());
    modal.open();
  }
  async createDataviewDashboard() {
    if (!this.settings.useDataviewForAnalytics) {
      new import_obsidian2.Notice("Dataview analytics is disabled in settings");
      return;
    }
    const dashboard = `---
para-type: dashboard
created: ${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}
---

# PARA Analytics Dashboard

## Active Projects
\`\`\`dataview
TABLE 
  status as Status,
  deadline as Deadline,
  progress as "Progress %",
  outcome as Outcome
FROM "${this.settings.projectsRoot}"
WHERE para-type = "project" AND status != "archived"
SORT deadline ASC
\`\`\`

## Areas Standards Check
\`\`\`dataview
TABLE
  standard as Standard,
  last-review as "Last Review",
  status as Status
FROM "${this.settings.areasRoot}"
WHERE para-type = "area"
SORT name ASC
\`\`\`

## Recently Modified
\`\`\`dataview
LIST
FROM ""
WHERE file.mtime >= date(today) - dur(7 days)
SORT file.mtime DESC
LIMIT 20
\`\`\`

## Project Completion Metrics
\`\`\`dataview
TABLE WITHOUT ID
  length(filter(file.lists, (x) => x.completed)) as "Completed Tasks",
  length(file.lists) as "Total Tasks",
  round((length(filter(file.lists, (x) => x.completed)) / length(file.lists)) * 100) as "Completion %"
FROM "${this.settings.projectsRoot}"
WHERE para-type = "project" AND file.lists
GROUP BY "All Projects"
\`\`\`

## Stale Projects (No updates > 2 weeks)
\`\`\`dataview
LIST
FROM "${this.settings.projectsRoot}"
WHERE para-type = "project" 
  AND status != "archived"
  AND file.mtime < date(today) - dur(14 days)
SORT file.mtime ASC
\`\`\`

## Quick Stats
\`\`\`dataview
TABLE WITHOUT ID
  length(filter(file.folder, (f) => contains(f, "${this.settings.projectsRoot}"))) as "Projects",
  length(filter(file.folder, (f) => contains(f, "${this.settings.areasRoot}"))) as "Areas",
  length(filter(file.folder, (f) => contains(f, "${this.settings.resourcesRoot}"))) as "Resources",
  length(filter(file.folder, (f) => contains(f, "${this.settings.archivesRoot}"))) as "Archived"
FROM ""
GROUP BY "PARA Stats"
\`\`\`
`;
    const dashboardPath = "PARA-Dashboard.md";
    const file = await this.app.vault.create(dashboardPath, dashboard);
    await this.app.workspace.getLeaf(true).openFile(file);
    new import_obsidian2.Notice("Dataview dashboard created!");
  }
  async checkProjectDeadlines() {
    const projects = this.app.vault.getMarkdownFiles().filter((f) => f.path.startsWith(this.settings.projectsRoot));
    const warnings = [];
    const today = /* @__PURE__ */ new Date();
    for (const file of projects) {
      const cache = this.app.metadataCache.getFileCache(file);
      const fm = cache?.frontmatter;
      if (fm?.deadline && fm?.status !== "archived") {
        const deadline = new Date(fm.deadline);
        const daysUntil = Math.floor((deadline.getTime() - today.getTime()) / (1e3 * 60 * 60 * 24));
        if (daysUntil <= this.settings.projectDeadlineWarningDays && daysUntil >= 0) {
          warnings.push(`${file.basename}: ${daysUntil} days until deadline`);
        } else if (daysUntil < 0) {
          warnings.push(`${file.basename}: OVERDUE by ${Math.abs(daysUntil)} days`);
        }
      }
    }
    if (warnings.length > 0) {
      new import_obsidian2.Notice(`\u26A0\uFE0F Project Deadlines:
${warnings.join("\n")}`, 8e3);
    }
  }
  isDeadlineNear(deadline) {
    if (!deadline || deadline === "none") return false;
    const deadlineDate = new Date(deadline);
    const today = /* @__PURE__ */ new Date();
    const daysUntil = Math.floor((deadlineDate.getTime() - today.getTime()) / (1e3 * 60 * 60 * 24));
    return daysUntil <= this.settings.projectDeadlineWarningDays;
  }
  async testApiConnection() {
    console.log("Testing Claude API connection...");
    if (!this.settings.anthropicApiKey) {
      new import_obsidian2.Notice("\u274C No API key configured. Add your key in settings.");
      return;
    }
    const modal = new import_obsidian2.Modal(this.app);
    modal.contentEl.createEl("h2", { text: "Testing Claude API Connection" });
    modal.contentEl.createEl("p", { text: "Testing with model: " + this.settings.anthropicModel });
    const statusEl = modal.contentEl.createEl("p", { text: "Connecting..." });
    modal.open();
    try {
      const testSystem = "You are a helpful assistant. Respond with a simple JSON object.";
      const testPrompt = 'Reply with JSON: {"status": "success", "message": "API connection working"}';
      console.log("Test request - Model:", this.settings.anthropicModel);
      console.log("Test request - Version:", this.settings.anthropicVersion);
      const result = await callClaudeJSON(this.settings, testSystem, testPrompt);
      console.log("Test successful:", result);
      statusEl.setText("\u2705 Success! API connection is working.");
      statusEl.createEl("br");
      statusEl.createEl("span", { text: `Model: ${this.settings.anthropicModel}` });
      statusEl.createEl("br");
      statusEl.createEl("span", { text: `Response: ${JSON.stringify(result)}` });
      new import_obsidian2.Notice("\u2705 Claude API connection successful!");
    } catch (error) {
      console.error("API test failed:", error);
      statusEl.setText("\u274C Connection failed!");
      statusEl.createEl("br");
      statusEl.createEl("span", { text: `Error: ${error.message}` });
      statusEl.createEl("br");
      statusEl.createEl("br");
      const tips = statusEl.createEl("div");
      tips.createEl("strong", { text: "Troubleshooting:" });
      const list = tips.createEl("ul");
      list.createEl("li", { text: "Check your API key is correct" });
      list.createEl("li", { text: "Try model: claude-3-5-sonnet-latest" });
      list.createEl("li", { text: "Ensure you have API credits" });
      list.createEl("li", { text: "Check Developer Console (Cmd+Option+I) for details" });
      new import_obsidian2.Notice(`\u274C API test failed: ${error.message}`, 8e3);
    }
  }
  /** ------- Settings persistence ------- */
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULTS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
};
var ParaClaudeSettingTab = class extends import_obsidian2.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "PARA Assistant (Claude) Settings" });
    containerEl.createEl("h3", { text: "API Configuration" });
    new import_obsidian2.Setting(containerEl).setName("Anthropic API Key").setDesc("Your API key from console.anthropic.com").addText((t) => t.setPlaceholder("sk-ant-...").setValue(this.plugin.settings.anthropicApiKey).onChange(async (v) => {
      this.plugin.settings.anthropicApiKey = v.trim();
      await this.plugin.saveSettings();
    }));
    new import_obsidian2.Setting(containerEl).setName("Model").setDesc("Claude model (August 2025 versions)").addDropdown((d) => d.addOptions({
      "claude-opus-4-1": "Claude Opus 4.1 (Best, 74.5% SWE-bench)",
      "claude-opus-4-0": "Claude Opus 4 (Extended reasoning)",
      "claude-sonnet-4-0": "Claude Sonnet 4 (Fast, 1M context)",
      "claude-3-7-sonnet-latest": "Claude 3.7 Sonnet (Hybrid reasoning)",
      "claude-3-5-haiku-latest": "Claude 3.5 Haiku (Fast & Cheap)",
      "claude-3-5-sonnet-latest": "Claude 3.5 Sonnet (Deprecating Oct 2025)"
    }).setValue(this.plugin.settings.anthropicModel || "claude-opus-4-1").onChange(async (v) => {
      this.plugin.settings.anthropicModel = v;
      await this.plugin.saveSettings();
      console.log("Model changed to:", v);
    }));
    new import_obsidian2.Setting(containerEl).setName("Max Tokens").setDesc("Maximum tokens for API responses").addText((t) => t.setValue(String(this.plugin.settings.maxTokens)).onChange(async (v) => {
      this.plugin.settings.maxTokens = Number(v) || 2e3;
      await this.plugin.saveSettings();
    }));
    new import_obsidian2.Setting(containerEl).setName("Temperature").setDesc("Creativity level (0.0 = focused, 1.0 = creative)").addSlider((s) => s.setLimits(0, 1, 0.1).setValue(this.plugin.settings.temperature).setDynamicTooltip().onChange(async (v) => {
      this.plugin.settings.temperature = v;
      await this.plugin.saveSettings();
    }));
    containerEl.createEl("h3", { text: "PARA Folders" });
    const roots = [
      ["projectsRoot", "Projects folder"],
      ["areasRoot", "Areas folder"],
      ["resourcesRoot", "Resources folder"],
      ["archivesRoot", "Archives folder"]
    ];
    for (const [key, label] of roots) {
      new import_obsidian2.Setting(containerEl).setName(label).addText((t) => t.setPlaceholder(this.plugin.settings[key]).setValue(this.plugin.settings[key]).onChange(async (v) => {
        this.plugin.settings[key] = v;
        await this.plugin.saveSettings();
      }));
    }
    containerEl.createEl("h3", { text: "Operation Settings" });
    new import_obsidian2.Setting(containerEl).setName("Dry Run Mode").setDesc("Preview changes without applying them").addToggle((t) => t.setValue(this.plugin.settings.dryRun).onChange(async (v) => {
      this.plugin.settings.dryRun = v;
      await this.plugin.saveSettings();
    }));
    new import_obsidian2.Setting(containerEl).setName("Auto Backup").setDesc("Create backups before modifying files").addToggle((t) => t.setValue(this.plugin.settings.autoBackup).onChange(async (v) => {
      this.plugin.settings.autoBackup = v;
      await this.plugin.saveSettings();
    }));
    new import_obsidian2.Setting(containerEl).setName("Show Cost Estimates").setDesc("Display estimated API costs before operations").addToggle((t) => t.setValue(this.plugin.settings.showCostEstimate).onChange(async (v) => {
      this.plugin.settings.showCostEstimate = v;
      await this.plugin.saveSettings();
    }));
    containerEl.createEl("h3", { text: "PARA Features" });
    new import_obsidian2.Setting(containerEl).setName("Auto Create Structure").setDesc("Automatically create PARA folder structure on plugin load").addToggle((t) => t.setValue(this.plugin.settings.autoCreateStructure).onChange(async (v) => {
      this.plugin.settings.autoCreateStructure = v;
      await this.plugin.saveSettings();
    }));
    new import_obsidian2.Setting(containerEl).setName("Use Bases for Views").setDesc("Use Obsidian Bases for primary PARA views (fast, native)").addToggle((t) => t.setValue(this.plugin.settings.useBasesForViews).onChange(async (v) => {
      this.plugin.settings.useBasesForViews = v;
      await this.plugin.saveSettings();
    }));
    new import_obsidian2.Setting(containerEl).setName("Use Dataview for Analytics").setDesc("Use Dataview plugin for advanced analytics (requires Dataview plugin)").addToggle((t) => t.setValue(this.plugin.settings.useDataviewForAnalytics).onChange(async (v) => {
      this.plugin.settings.useDataviewForAnalytics = v;
      await this.plugin.saveSettings();
    }));
    new import_obsidian2.Setting(containerEl).setName("Enable Quick Capture").setDesc("Enable quick capture system for inbox items").addToggle((t) => t.setValue(this.plugin.settings.enableQuickCapture).onChange(async (v) => {
      this.plugin.settings.enableQuickCapture = v;
      await this.plugin.saveSettings();
    }));
    new import_obsidian2.Setting(containerEl).setName("Archive Completed Projects").setDesc("Automatically move completed projects to archives").addToggle((t) => t.setValue(this.plugin.settings.archiveCompletedProjects).onChange(async (v) => {
      this.plugin.settings.archiveCompletedProjects = v;
      await this.plugin.saveSettings();
    }));
    new import_obsidian2.Setting(containerEl).setName("Project Deadline Warning (days)").setDesc("Days before deadline to show warnings (0 to disable)").addText((t) => t.setValue(String(this.plugin.settings.projectDeadlineWarningDays)).onChange(async (v) => {
      this.plugin.settings.projectDeadlineWarningDays = Number(v) || 3;
      await this.plugin.saveSettings();
    }));
    new import_obsidian2.Setting(containerEl).setName("Weekly Review Day").setDesc("Preferred day for weekly review reminders").addDropdown((d) => d.addOptions({
      "Monday": "Monday",
      "Tuesday": "Tuesday",
      "Wednesday": "Wednesday",
      "Thursday": "Thursday",
      "Friday": "Friday",
      "Saturday": "Saturday",
      "Sunday": "Sunday"
    }).setValue(this.plugin.settings.weeklyReviewDay).onChange(async (v) => {
      this.plugin.settings.weeklyReviewDay = v;
      await this.plugin.saveSettings();
    }));
    containerEl.createEl("h3", { text: "Settings Management" });
    new import_obsidian2.Setting(containerEl).setName("Export Settings").setDesc("Export current settings to clipboard").addButton((b) => b.setButtonText("Export").onClick(async () => {
      const settings = { ...this.plugin.settings };
      settings.anthropicApiKey = "";
      await navigator.clipboard.writeText(JSON.stringify(settings, null, 2));
      new import_obsidian2.Notice("Settings copied to clipboard (API key excluded)");
    }));
    new import_obsidian2.Setting(containerEl).setName("Import Settings").setDesc("Import settings from clipboard").addButton((b) => b.setButtonText("Import").onClick(async () => {
      try {
        const text = await navigator.clipboard.readText();
        const imported = JSON.parse(text);
        imported.anthropicApiKey = this.plugin.settings.anthropicApiKey;
        this.plugin.settings = Object.assign({}, DEFAULTS, imported);
        await this.plugin.saveSettings();
        this.display();
        new import_obsidian2.Notice("Settings imported successfully");
      } catch (e) {
        new import_obsidian2.Notice("Failed to import settings: Invalid JSON");
      }
    }));
  }
};
function promptUser(app, label) {
  return new Promise((resolve) => {
    const m = new import_obsidian2.Modal(app);
    m.contentEl.createEl("h3", { text: label });
    const inp = m.contentEl.createEl("input", { type: "text" });
    inp.style.width = "100%";
    const buttonDiv = m.contentEl.createDiv({ cls: "modal-button-container" });
    buttonDiv.style.marginTop = "20px";
    new import_obsidian2.ButtonComponent(buttonDiv).setButtonText("OK").setCta().onClick(() => {
      const v = inp.value.trim();
      m.close();
      resolve(v || null);
    });
    new import_obsidian2.ButtonComponent(buttonDiv).setButtonText("Cancel").onClick(() => {
      m.close();
      resolve(null);
    });
    m.open();
    inp.focus();
  });
}
//# sourceMappingURL=main.js.map
