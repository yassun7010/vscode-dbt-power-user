import { createApp } from "vue";
const vscode = acquireVsCodeApi();

async function executeCommand(command, args) {
  return await vscode.postMessage({ command, ...args });
}

const app = createApp({
  data() {
    return {
      docs: undefined,
      aiEnabled: false,
      dialogType: "Existing file",
    };
  },
  methods: {
    updateDocs(docs) {
      this.docs = docs;
      this.aiEnabled = docs?.aiEnabled;
    },
    updateColumns(columns) {
      this.docs.columns = columns.map((column) => {
        const existingColumn = this.docs?.columns.find(
          (existingColumn) => column.name === existingColumn.name,
        );
        return {
          name: column.name,
          type: column.type,
          description: existingColumn?.description || "",
          generated: existingColumn?.generated || false,
          source: existingColumn !== undefined ? "YAML" : "DATABASE",
        };
      });
    },
    updateAIGeneratedModelDocs(description) {
      this.docs.description = description;
      this.docs.generated = true;
    },
    updateAIGeneratedColumnDocs(generatedColumnDescriptions) {
      const generatedColumns = Object.fromEntries(
        generatedColumnDescriptions.map((d) => [d.name, d.description]),
      );
      const columns = this.docs.columns.reduce((agg, current) => {
        agg.push({
          ...current,
          description: generatedColumns[current.name] || current.description,
          generated:
            generatedColumns[current.name] !== undefined || current.generated,
        });
        return agg;
      }, []);

      this.docs = {
        ...this.docs,
        columns: columns,
      };
    },
    aiEnabledChanged(config) {
      this.aiEnabled = config.aiEnabled;
    },
    toggleRating(ref) {
      let element = this.$refs[ref];
      if (Array.isArray(element)) {
        element = element[0];
      }
      element.toggle();
    },
    async generateDocsForModel() {
      await executeCommand("generateDocsForModel", {
        description: this.docs?.description,
        columns: this.docs?.columns.map((col) => ({
          name: col.name,
          type: col.type,
          description: col.description,
        })),
      });
    },
    async generateDocsForColumn(columnName) {
      await executeCommand("generateDocsForColumn", {
        description: this.docs?.description,
        columnName,
        columns: this.docs?.columns.map((col) => ({
          name: col.name,
          type: col.type,
          description: col.description,
        })),
      });
    },
    async fetchMetadataFromDatabase() {
      await executeCommand("fetchMetadataFromDatabase");
    },
    async saveDocumentation() {
      await executeCommand(
        "saveDocumentation",
        JSON.parse(
          JSON.stringify({
            patchPath: this.patchPath,
            name: this.name,
            description: this.docs?.description,
            columns: this.docs?.columns,
            dialogType: this.dialogType,
          }),
        ),
      );
    },
  },
  computed: {
    hasData() {
      return this.docs;
    },
    name() {
      return this.docs ? this.docs.name : "";
    },
    generated() {
      return this.docs ? this.docs.generated : false;
    },
    aiEnabled() {
      return this.aiEnabled || false;
    },
    patchPath() {
      return this.docs ? this.docs.patchPath : "";
    },
  },
  mounted() {
    window.addEventListener("message", (event) => {
      console.log(event);
      const { command } = event?.data;
      switch (command) {
        case "renderDocumentation":
          this.updateDocs(event.data.docs);
          break;
        case "renderColumnsFromMetadataFetch":
          this.updateColumns(event.data.columns);
          break;
        case "renderAIGeneratedModelDocs":
          this.updateAIGeneratedModelDocs(event.data.description);
          break;
        case "renderAIGeneratedColumnDocs":
          this.updateAIGeneratedColumnDocs(event.data.columns);
          break;
        case "updateConfig":
          this.aiEnabledChanged(event.data.config);
          break;
      }
    });
  },
});

Comment = {
  props: ["data"],
  data() {
    return {
      isActive: false,
      comment: "",
    };
  },
  methods: {
    toggle() {
      this.isActive = !this.isActive;
    },
    async sendFeedback(rating) {
      await executeCommand("sendFeedback", {
        data: {
          column: this.data.hasOwnProperty("name") ? this.data.name : undefined,
          description: this.data.description,
          model: this.modelname,
        },
        rating,
        comment: this.comment,
      });
      this.comment = "";
      this.toggle();
    },
  },
  template: `
    <div class="rating" v-show="isActive">
      <vscode-text-area
        v-model="comment"
        placeholder="Tell us what you think about the AI generated documentation"
        resize="vertical"
        rows="5">
        <h3>Rate the generated documentation</h3>
      </vscode-text-area>
      <div class="column-actions">
        <vscode-button @click="sendFeedback('good')">
          <span slot="start" class="codicon codicon-thumbsup"></span>
        </vscode-button>
        <vscode-button @click="sendFeedback('bad')">
          <span slot="start" class="codicon codicon-thumbsdown"></span>
        </vscode-button>
      </div>
    </div>`,
};

app.component("Comment", Comment);

app.config.errorHandler = (err) => {
  console.log(err);
};

app.mount("#app");
