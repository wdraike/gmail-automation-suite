function showEnhancedLabelManager() {
  const card = CardService.newCardBuilder().setHeader(
    CardService.newCardHeader()
      .setTitle("Label Manager")
      .setImageUrl(
        "https://www.gstatic.com/images/icons/material/system/1x/label_black_48dp.png"
      )
  );

  // Get all user labels and organize them hierarchically
  const labels = getGmailLabels(false);
  const labelHierarchy = organizeLabelsHierarchically(labels);

  // Add search section at the top
  const searchSection = CardService.newCardSection();

  searchSection.addWidget(
    CardService.newTextInput()
      .setFieldName("labelSearch")
      .setTitle("Search Labels")
      .setHint("Type to filter labels")
      .setOnChangeAction(
        CardService.newAction().setFunctionName("filterLabels")
      )
  );

  card.addSection(searchSection);

  // Add the label section with hierarchical display
  let labelSection = CardService.newCardSection()
    .setHeader("Your Gmail Labels")
    .setCollapsible(false);

  // Add hierarchical label display
  addHierarchicalLabelsToSection(labelSection, labelHierarchy, 0);

  // Add the label management section here, after any existing sections
  labelSection = CardService.newCardSection().setHeader("Label Management");

  labelSection.addWidget(
    CardService.newTextButton()
      .setText("Enhanced Label Manager")
      .setOnClickAction(
        CardService.newAction().setFunctionName("showEnhancedLabelManager")
      )
  );

  card.addSection(labelSection);

  // Add actions section
  const actionsSection =
    CardService.newCardSection().setHeader("Label Actions");

  actionsSection.addWidget(
    CardService.newButtonSet()
      .addButton(
        CardService.newTextButton()
          .setText("Create New Label")
          .setOnClickAction(
            CardService.newAction().setFunctionName("showCreateLabelDialog")
          )
      )
      .addButton(
        CardService.newTextButton()
          .setText("Manage Categories")
          .setOnClickAction(
            CardService.newAction().setFunctionName("showCategoryManager")
          )
      )
  );

  card.addSection(actionsSection);

  return card.build();
}
/**
 * Organize labels into a hierarchical structure
 *
 * @param {GmailLabel[]} labels - Array of Gmail labels
 * @returns {Object} Hierarchical structure of labels
 */
function organizeLabelsHierarchically(labels) {
  console.log("Organizing " + labels.length + " labels hierarchically");
  
  const hierarchy = {
    root: {
      children: {},
      labels: [],
    },
  };

  // First pass: organize labels into hierarchy
  labels.forEach(function(label) {
    if (!label || !label.name) {
      console.log("Skipping invalid label", label);
      return;
    }
    
    const name = label.name;
    const parts = name.split("/");
    
    console.log("Processing label: " + name + " with " + parts.length + " parts");

    if (parts.length === 1) {
      // Top-level label
      hierarchy.root.labels.push({
        name: name,
        data: label,
        type: 'label'
      });
      console.log("Added top-level label: " + name);
    } else {
      // Nested label
      let currentLevel = hierarchy.root;
      let currentPath = "";

      // Create the path step by step
      for (let i = 0; i < parts.length - 1; i++) {
        currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
        
        if (!currentLevel.children[parts[i]]) {
          currentLevel.children[parts[i]] = {
            name: parts[i],
            path: currentPath,
            type: 'folder',
            children: {},
            labels: [],
          };
          console.log("Created folder: " + currentPath);
        }

        currentLevel = currentLevel.children[parts[i]];
      }

      // Add the leaf label
      currentLevel.labels.push({
        name: parts[parts.length - 1],
        fullName: name,
        data: label,
        type: 'label'
      });
      console.log("Added nested label: " + name + " to folder: " + currentPath);
    }
  });

  console.log("Hierarchy created with " + hierarchy.root.labels.length + " top-level labels");
  return hierarchy;
}

/**
 * Add hierarchical labels to a section
 *
 * @param {CardSection} section - The card section to add labels to
 * @param {Object} hierarchy - The label hierarchy object
 * @param {number} level - Current nesting level (for indentation)
 */
function addHierarchicalLabelsToSection(section, hierarchy, level) {
  // First add top-level labels
  if (hierarchy.labels && hierarchy.labels.length > 0) {
    hierarchy.labels.forEach((labelInfo) => {
      const labelDisplay = `${" ".repeat(level * 2)}${labelInfo.name} (${
        labelInfo.count
      })`;

      section.addWidget(
        CardService.newTextButton()
          .setText(labelDisplay)
          .setOnClickAction(
            CardService.newAction()
              .setFunctionName("selectLabel")
              .setParameters({
                selectedLabel: labelInfo.fullName || labelInfo.name,
              })
          )
      );
    });
  }

  // Then add child categories with their labels
  if (hierarchy.children) {
    Object.keys(hierarchy.children)
      .sort()
      .forEach((key) => {
        const child = hierarchy.children[key];

        // Add category header
        section.addWidget(
          CardService.newTextParagraph().setText(
            `${" ".repeat(level * 2)}📁 ${child.name}`
          )
        );

        // Recursively add children
        addHierarchicalLabelsToSection(section, child, level + 1);
      });
  }
}

function selectLabel(e) {
  // Get the selected label from parameters
  const selectedLabel = e && e.parameters ? e.parameters.selectedLabel : null;

  if (!selectedLabel) {
    return CardService.newActionResponseBuilder()
      .setNotification(
        CardService.newNotification().setText("No label selected")
      )
      .build();
  }

  // Get the label information
  const label = GmailApp.getUserLabelByName(selectedLabel);
  if (!label) {
    return CardService.newActionResponseBuilder()
      .setNotification(
        CardService.newNotification().setText(
          `Label "${selectedLabel}" not found`
        )
      )
      .build();
  }

  // Create a new card focused on the selected label
  const card = CardService.newCardBuilder().setHeader(
    CardService.newCardHeader()
      .setTitle("Label Details")
      .setSubtitle(selectedLabel)
      .setImageUrl(
        "https://www.gstatic.com/images/icons/material/system/1x/label_black_48dp.png"
      )
  );

  // Add label statistics section
  const statsSection =
    CardService.newCardSection().setHeader("Label Statistics");

  // Get threads with this label
  const threads = label.getThreads(0, 100);
  const threadCount = threads.length < 100 ? threads.length : "100+";

  statsSection.addWidget(
    CardService.newKeyValue()
      .setTopLabel("Thread Count")
      .setContent(threadCount.toString())
  );

  // Get unread count
  let unreadCount = 0;
  for (let i = 0; i < Math.min(threads.length, 100); i++) {
    if (threads[i].isUnread()) {
      unreadCount++;
    }
  }

  statsSection.addWidget(
    CardService.newKeyValue()
      .setTopLabel("Unread Threads")
      .setContent(unreadCount.toString())
  );

  card.addSection(statsSection);

  // Add actions section
  const actionsSection =
    CardService.newCardSection().setHeader("Label Actions");

  actionsSection.addWidget(
    CardService.newButtonSet()
      .addButton(
        CardService.newTextButton()
          .setText("View Emails")
          .setOpenLink(
            CardService.newOpenLink().setUrl(
              `https://mail.google.com/mail/u/0/#label/${encodeURIComponent(
                selectedLabel
              )}`
            )
          )
      )
      .addButton(
        CardService.newTextButton()
          .setText("Manage Categories")
          .setOnClickAction(
            CardService.newAction()
              .setFunctionName("showLabelCategories")
              .setParameters({
                labelName: selectedLabel,
              })
          )
      )
  );

  // Add option to remove or rename label
  actionsSection.addWidget(
    CardService.newButtonSet()
      .addButton(
        CardService.newTextButton()
          .setText("Rename Label")
          .setOnClickAction(
            CardService.newAction()
              .setFunctionName("showRenameLabelDialog")
              .setParameters({
                labelName: selectedLabel,
              })
          )
      )
      .addButton(
        CardService.newTextButton()
          .setText("Delete Label")
          .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
          .setBackgroundColor("#FF0000")
          .setOnClickAction(
            CardService.newAction()
              .setFunctionName("confirmDeleteLabel")
              .setParameters({
                labelName: selectedLabel,
              })
          )
      )
  );

  card.addSection(actionsSection);

  // Add a section for recent emails with this label
  const recentEmailsSection =
    CardService.newCardSection().setHeader("Recent Emails");

  // Get up to 5 recent threads
  const recentThreads = threads.slice(0, 5);

  if (recentThreads.length > 0) {
    recentThreads.forEach((thread) => {
      const messages = thread.getMessages();
      const lastMessage = messages[messages.length - 1];

      recentEmailsSection.addWidget(
        CardService.newKeyValue()
          .setTopLabel(lastMessage.getFrom())
          .setContent(lastMessage.getSubject())
          .setMultiline(true)
          .setBottomLabel(new Date(lastMessage.getDate()).toLocaleString())
          .setOnClickAction(
            CardService.newAction()
              .setFunctionName("openThread")
              .setParameters({
                threadId: thread.getId(),
              })
          )
      );
    });
  } else {
    recentEmailsSection.addWidget(
      CardService.newTextParagraph().setText("No recent emails with this label")
    );
  }

  card.addSection(recentEmailsSection);

  // Add a button to return to all labels
  const navigationSection = CardService.newCardSection();

  navigationSection.addWidget(
    CardService.newTextButton()
      .setText("Back to All Labels")
      .setOnClickAction(
        CardService.newAction().setFunctionName("showEnhancedLabelManager")
      )
  );

  card.addSection(navigationSection);

  return CardService.newNavigation().pushCard(card.build());
}
function showCreateLabelDialog() {
  const card = CardService.newCardBuilder().setHeader(
    CardService.newCardHeader().setTitle("Create New Label")
  );

  const createSection = CardService.newCardSection();

  // Add parent label dropdown
  const parentLabelInput = CardService.newSelectionInput()
    .setFieldName("parentLabel")
    .setTitle("Parent Label (Optional)")
    .setType(CardService.SelectionInputType.DROPDOWN);

  parentLabelInput.addItem("(No parent - top level)", "", true);

  // Get all labels for parent selection
  const labels = getGmailLabels(false);
  labels.sort((a, b) => a.getName().localeCompare(b.getName()));

  labels.forEach((label) => {
    parentLabelInput.addItem(label.getName(), label.getName(), false);
  });

  createSection.addWidget(parentLabelInput);

  // Add label name input
  createSection.addWidget(
    CardService.newTextInput()
      .setFieldName("labelName")
      .setTitle("Label Name")
      .setHint("Enter a name for the new label")
  );

  // Add action buttons
  createSection.addWidget(
    CardService.newButtonSet()
      .addButton(
        CardService.newTextButton()
          .setText("Create Label")
          .setOnClickAction(
            CardService.newAction().setFunctionName("createNewLabel")
          )
      )
      .addButton(
        CardService.newTextButton()
          .setText("Cancel")
          .setOnClickAction(
            CardService.newAction().setFunctionName("showEnhancedLabelManager")
          )
      )
  );

  card.addSection(createSection);

  return CardService.newNavigation().pushCard(card.build());
}

function createNewLabel(e) {
  const parentLabel = e.formInput.parentLabel;
  const labelName = e.formInput.labelName;

  if (!labelName || labelName.trim() === "") {
    return CardService.newActionResponseBuilder()
      .setNotification(
        CardService.newNotification().setText("Label name cannot be empty")
      )
      .build();
  }

  // Form the full label path
  const fullLabelPath = parentLabel ? `${parentLabel}/${labelName}` : labelName;

  try {
    // Check if label already exists
    if (GmailApp.getUserLabelByName(fullLabelPath)) {
      return CardService.newActionResponseBuilder()
        .setNotification(
          CardService.newNotification().setText(
            `Label "${fullLabelPath}" already exists`
          )
        )
        .build();
    }

    // Create the label
    if (fullLabelPath.includes("/")) {
      createLabelHierarchy(fullLabelPath);
    } else {
      GmailApp.createLabel(fullLabelPath);
    }

    return CardService.newActionResponseBuilder()
      .setNotification(
        CardService.newNotification().setText(
          `Label "${fullLabelPath}" created successfully`
        )
      )
      .setNavigation(
        CardService.newNavigation().pushCard(showEnhancedLabelManager())
      )
      .build();
  } catch (error) {
    return CardService.newActionResponseBuilder()
      .setNotification(
        CardService.newNotification().setText(
          `Error creating label: ${error.toString()}`
        )
      )
      .build();
  }
}

function showRenameLabelDialog(e) {
  const labelName = e.parameters.labelName;

  if (!labelName) {
    return CardService.newActionResponseBuilder()
      .setNotification(
        CardService.newNotification().setText("No label specified")
      )
      .build();
  }

  const card = CardService.newCardBuilder().setHeader(
    CardService.newCardHeader().setTitle(`Rename Label: ${labelName}`)
  );

  const renameSection = CardService.newCardSection();

  // Show current name
  renameSection.addWidget(
    CardService.newTextParagraph().setText(`Current name: ${labelName}`)
  );

  // Add new name input
  renameSection.addWidget(
    CardService.newTextInput()
      .setFieldName("newLabelName")
      .setTitle("New Label Name")
      .setHint("Enter a new name for the label")
  );

  // Add action buttons
  renameSection.addWidget(
    CardService.newButtonSet()
      .addButton(
        CardService.newTextButton()
          .setText("Rename Label")
          .setOnClickAction(
            CardService.newAction()
              .setFunctionName("renameLabel")
              .setParameters({
                labelName: labelName,
              })
          )
      )
      .addButton(
        CardService.newTextButton()
          .setText("Cancel")
          .setOnClickAction(
            CardService.newAction()
              .setFunctionName("selectLabel")
              .setParameters({
                selectedLabel: labelName,
              })
          )
      )
  );

  card.addSection(renameSection);

  return CardService.newNavigation().pushCard(card.build());
}

function renameLabel(e) {
  const labelName = e.parameters.labelName;
  const newLabelName = e.formInput.newLabelName;

  if (!labelName || !newLabelName || newLabelName.trim() === "") {
    return CardService.newActionResponseBuilder()
      .setNotification(
        CardService.newNotification().setText(
          "Both old and new label names are required"
        )
      )
      .build();
  }

  try {
    // Get the label
    const label = GmailApp.getUserLabelByName(labelName);

    if (!label) {
      return CardService.newActionResponseBuilder()
        .setNotification(
          CardService.newNotification().setText(
            `Label "${labelName}" not found`
          )
        )
        .build();
    }

    // Check if target name already exists
    if (GmailApp.getUserLabelByName(newLabelName)) {
      return CardService.newActionResponseBuilder()
        .setNotification(
          CardService.newNotification().setText(
            `Label "${newLabelName}" already exists`
          )
        )
        .build();
    }

    // Rename the label
    label.setName(newLabelName);

    return CardService.newActionResponseBuilder()
      .setNotification(
        CardService.newNotification().setText(
          `Label renamed successfully to "${newLabelName}"`
        )
      )
      .setNavigation(
        CardService.newNavigation().pushCard(
          selectLabel({ parameters: { selectedLabel: newLabelName } }).card
        )
      )
      .build();
  } catch (error) {
    return CardService.newActionResponseBuilder()
      .setNotification(
        CardService.newNotification().setText(
          `Error renaming label: ${error.toString()}`
        )
      )
      .build();
  }
}
function confirmDeleteLabel(e) {
  const labelName = e.parameters.labelName;

  if (!labelName) {
    return CardService.newActionResponseBuilder()
      .setNotification(
        CardService.newNotification().setText("No label specified")
      )
      .build();
  }

  const card = CardService.newCardBuilder().setHeader(
    CardService.newCardHeader().setTitle(`Delete Label: ${labelName}`)
  );

  const confirmSection = CardService.newCardSection();

  // Add warning message
  confirmSection.addWidget(
    CardService.newTextParagraph().setText(
      `Are you sure you want to delete the label "${labelName}"? This action cannot be undone.`
    )
  );

  // Get thread count for this label
  const label = GmailApp.getUserLabelByName(labelName);
  if (label) {
    const threads = label.getThreads(0, 1);
    if (threads.length > 0) {
      confirmSection.addWidget(
        CardService.newTextParagraph().setText(
          "⚠️ This label has emails attached to it. Deleting it will remove the label from these emails."
        )
      );
    }
  }

  // Add action buttons
  confirmSection.addWidget(
    CardService.newButtonSet()
      .addButton(
        CardService.newTextButton()
          .setText("Delete")
          .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
          .setBackgroundColor("#FF0000")
          .setOnClickAction(
            CardService.newAction()
              .setFunctionName("deleteLabel")
              .setParameters({
                labelName: labelName,
              })
          )
      )
      .addButton(
        CardService.newTextButton()
          .setText("Cancel")
          .setOnClickAction(
            CardService.newAction()
              .setFunctionName("selectLabel")
              .setParameters({
                selectedLabel: labelName,
              })
          )
      )
  );

  card.addSection(confirmSection);

  return CardService.newNavigation().pushCard(card.build());
}

function deleteLabel(e) {
  const labelName = e.parameters.labelName;

  if (!labelName) {
    return CardService.newActionResponseBuilder()
      .setNotification(
        CardService.newNotification().setText("No label specified")
      )
      .build();
  }

  try {
    // Get the label
    const label = GmailApp.getUserLabelByName(labelName);

    if (!label) {
      return CardService.newActionResponseBuilder()
        .setNotification(
          CardService.newNotification().setText(
            `Label "${labelName}" not found`
          )
        )
        .build();
    }

    // Delete the label
    label.deleteLabel();

    return CardService.newActionResponseBuilder()
      .setNotification(
        CardService.newNotification().setText(
          `Label "${labelName}" deleted successfully`
        )
      )
      .setNavigation(
        CardService.newNavigation().pushCard(showEnhancedLabelManager())
      )
      .build();
  } catch (error) {
    return CardService.newActionResponseBuilder()
      .setNotification(
        CardService.newNotification().setText(
          `Error deleting label: ${error.toString()}`
        )
      )
      .build();
  }
}

function openThread(e) {
  const threadId = e.parameters.threadId;

  if (!threadId) {
    return CardService.newActionResponseBuilder()
      .setNotification(
        CardService.newNotification().setText("No thread specified")
      )
      .build();
  }

  // Create a URL to open this thread
  const threadUrl = `https://mail.google.com/mail/u/0/#inbox/${threadId}`;

  return CardService.newActionResponseBuilder()
    .setOpenLink(CardService.newOpenLink().setUrl(threadUrl))
    .build();
}

// Conditional exports for testing (works in both Node.js and Apps Script)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    showEnhancedLabelManager,
    organizeLabelsHierarchically,
    addHierarchicalLabelsToSection,
    selectLabel,
    showCreateLabelDialog,
    createNewLabel,
    showRenameLabelDialog,
    renameLabel,
    confirmDeleteLabel,
    deleteLabel,
    openThread
  };
}
