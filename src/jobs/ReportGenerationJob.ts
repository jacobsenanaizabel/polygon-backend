import { Job } from './Job';
import { Task, TaskStatus } from '../models/Task';
import { Workflow } from '../models/Workflow';
import { AppDataSource } from '../data-source';

interface CompletedTaskEntry {
	taskId: string;
	type: string;
	status: 'completed';
	output: unknown;
}

interface FailedTaskEntry {
	taskId: string;
	type: string;
	status: 'failed';
	error: string | null;
}

type ReportEntry = CompletedTaskEntry | FailedTaskEntry;

interface Report {
	workflowId: string;
	tasks: ReportEntry[];
	finalReport: string;
}

const STATUS = new Set(['completed', 'failed']);

export class ReportGenerationJob implements Job {
	async run(task: Task): Promise<Report> {
		console.log(`Generating workflow report for task ${task.taskId}...`);

		const workflowRepository = AppDataSource.getRepository(Workflow);
		const workflow = await workflowRepository.findOne({
			where: { workflowId: task.workflow.workflowId },
			relations: ['tasks'],
		});

		if (!workflow) {
			throw new Error(`Cannot generate report workflowId ${task.workflow.workflowId} not found`);
		}

		const preceding = workflow.tasks
			.filter((t) => t.taskId !== task.taskId)
			.filter((t) => t.stepNumber < task.stepNumber)
			.sort((a, b) => a.stepNumber - b.stepNumber);

		const loading = preceding.filter((t) => !STATUS.has(t.status));
		if (loading.length > 0) {
			throw new Error('Cannot generate report yet');
		}

		const entries: ReportEntry[] = preceding.map((t) => createReportEntry(t));
		const completedCount = entries.filter((e) => e.status === 'completed').length;

		const report: Report = {
			workflowId: workflow.workflowId,
			tasks: entries,
			finalReport: `${completedCount} of ${preceding.length} preceding task(s) completed successfully`,
		};

		console.log(`Report for task ${task.taskId}: ${completedCount}/${preceding.length} preceding tasks succeeded`);
		return report;
	}
}
function createReportEntry(finishedTask: Task): ReportEntry {
	const baseFields = {
		taskId: finishedTask.taskId,
		type: finishedTask.taskType,
	};

	if (finishedTask.status === TaskStatus.Completed) {
		let parsedOutput: unknown = null;

		if (finishedTask.output != null) {
			try {
				parsedOutput = JSON.parse(finishedTask.output);
			} catch {
				parsedOutput = finishedTask.output;
			}
		}

		return {
			...baseFields,
			status: 'completed',
			output: parsedOutput,
		};
	}

	return {
		...baseFields,
		status: 'failed',
		error: finishedTask.error ?? null,
	};
}
