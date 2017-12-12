import { TestFileAssertionStatus } from "jest-editor-support";
import { observable, IObservableArray, computed, action } from "mobx";
import TreeNode from "../stores/TreeNode";
import { TestReconcilationState } from "jest-editor-support";
import getLabel from "../components/tree-node-label";
import { filterFiles, filterTree } from "../util/search";

import { Coverage } from "./Coverage";
import { TotalResult } from "./TotalResult";
import CoverageSummary from "./CoverageSummary";
import { Icons } from "../util/constants";

// wiretap("App");

export default class Files {
  @observable files: IObservableArray<TreeNode> = observable([]);
  @observable tests: IObservableArray<TreeNode> = observable([]);
  @observable text: string = "";
  @observable testsOnly: boolean = true;
  @observable totalResult = new TotalResult();
  @observable totalCoverage = new CoverageSummary();

  // A flat map of all the nodes of the directory tree.
  // We use this to perform updates on the tree nodes.
  @observable nodes: Map<string, TreeNode> = new Map();

  initialize(
    tests: TreeNode[],
    files: TreeNode[],
    nodes: Map<string, TreeNode>
  ) {
    this.files.clear();
    this.files.push(...files);

    const rootNode = new TreeNode();
    rootNode.label = "root";
    rootNode.childNodes = tests;
    const filtered = filterTree(rootNode);

    this.tests.clear();
    this.tests.push(...filtered.childNodes);

    nodes.forEach((value: TreeNode, key: string) => {
      this.nodes.set(key, value);
    });
  }

  getNodeByPath(path: string) {
    return this.nodes.get(path);
  }

  updateFileIcon(status: TestReconcilationState, node: TreeNode) {
    if (status === "KnownSuccess") {
      node.iconName = "pt-icon-tick-circle";
    } else if (status === "KnownFail") {
      node.iconName = "pt-icon-issue";
    } else if (status === "KnownSkip") {
      node.iconName = "pt-icon-document";
    }
  }

  updateWithAssertionStatus(tests: TestFileAssertionStatus[]) {
    tests.map(test => {
      const nodeToUpdate = this.nodes.get(test.file);

      let className = "";
      if (test.status === "KnownSuccess") {
        className = "success";
      } else if (test.status === "KnownFail") {
        className = "failed";
      } else if (test.status === "KnownSkip") {
        className = "skip";
      }
      if (nodeToUpdate) {
        nodeToUpdate.status = test.status as TestReconcilationState;
        nodeToUpdate.output = test.message;
        nodeToUpdate.className = className;

        this.updateFileIcon(test.status, nodeToUpdate);

        for (const assertion of test.assertions) {
          const itBlock = nodeToUpdate.itBlocks.find(
            it => it.name === assertion.title
          );

          if (itBlock) {
            itBlock.status = assertion.status;
            itBlock.assertionMessage = assertion.message;
            itBlock.isExecuting = false;
            itBlock.snapshotErrorStatus = assertion.message.includes(
              "stored snapshot"
            )
              ? "error"
              : "unknown";
          }
        }
      }
    });
  }

  updateCoverage(coverage: Coverage) {
    for (let node of this.nodes.values()) {
      if (!node.isTest) {
        const coverageForFile = coverage.getCoverageForFile(node.path);
        if (coverageForFile) {
          const summary = coverageForFile.toSummary();
          node.coverage.branchesPercentage = summary.branches.pct;
          node.coverage.linePercentage = summary.lines.pct;
          node.coverage.functionPercentage = summary.functions.pct;
          node.coverage.statementPercentage = summary.statements.pct;

          node.secondaryLabel = getLabel(`${summary.lines.pct}%`);
        }
      }
    }

    const summary = coverage.getSummary();
    this.totalCoverage.branchesPercentage = summary.branchesPercentage;
    this.totalCoverage.functionPercentage = summary.functionPercentage;
    this.totalCoverage.linePercentage = summary.linePercentage;
    this.totalCoverage.statementPercentage = summary.statementPercentage;
  }

  updateTotalResult(result) {
    this.totalResult.numPassedTestSuites = result.numPassedTestSuites;
    this.totalResult.numFailedTestSuites = result.numFailedTestSuites;
    this.totalResult.numPassedTests = result.numPassedTests;
    this.totalResult.numFailedTests = result.numFailedTests;
    this.totalResult.matchedSnaphots = result.snapshot.matched;
    this.totalResult.unmatchedSnapshots = result.snapshot.unmatched;
  }

  // Toggles spin animation in all the nodes by switching the class
  toggleStatusToAll() {
    this.resetStatus();

    this.nodes.forEach((node: TreeNode) => {
      if (node.type === "file") {
        node.className = "spin";
        node.iconName = "pt-icon-locate";
      }

      node.itBlocks.map(it => {
        it.isExecuting = true;
      });
    });
  }

  resetStatusToAll() {
    this.resetStatus();
  }

  // Unhighlight all the nodes
  unhighlightAll() {
    this.nodes.forEach((node: TreeNode) => {
      node.isSelected = false;
    });
  }

  search(text: string) {
    this.text = text;
  }

  @computed
  get allFiles() {
    if (this.text.trim() === "") {
      return this.files;
    }

    return filterFiles(this.nodes, this.text);
  }

  @computed
  get testFiles() {
    if (this.text.trim() === "") {
      return this.tests;
    }

    return filterFiles(this.nodes, this.text, node => {
      return !!(node && node.isTest);
    });
  }

  @action
  clear() {
    this.files.clear();
    this.tests.clear();
  }

  // Resets previous execution status of the UI
  private resetStatus() {
    this.nodes.forEach((node: TreeNode) => {
      node.iconName = Icons.FileIcon;
      node.className = "";
      node.itBlocks.map(it => {
        it.isExecuting = false;
        it.status = "";
      });
    });
  }
}