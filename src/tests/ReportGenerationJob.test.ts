import { ReportGenerationJob } from '../jobs/ReportGenerationJob';
import { Task, TaskStatus } from '../models/Task';
import { AppDataSource } from '../data-source';

jest.mock('../data-source', () => ({
    AppDataSource: { getRepository: jest.fn() },
}));

const mockGetRepository = AppDataSource.getRepository as jest.Mock;

function makeReportTask(overrides: Partial<Task> = {}): Task {
	return {
		taskId: 'report-task-id',
		taskType: 'reportGeneration',
		status: TaskStatus.Queued,
		stepNumber: 4,
		workflow: { workflowId: 'workflow-1' },
		...overrides,
	} as unknown as Task;
}

function makeTask(overrides: Partial<Task> = {}): Task {
	return {
		taskId: 'task-1',
		taskType: 'polygonArea',
		status: TaskStatus.Completed,
		stepNumber: 1,
		output: JSON.stringify({ area: 8363367, unit: 'm^2' }),
		workflow: { workflowId: 'workflow-1' },
		...overrides,
	} as unknown as Task;
}

function mockWorkflow(tasks: Task[]) {
	mockGetRepository.mockReturnValueOnce({
		findOne: jest.fn().mockResolvedValue({ workflowId: 'workflow-1', tasks }),
	});
}

describe('ReportGenerationJob', () => {
    let job: ReportGenerationJob;

    beforeEach(() => {
        job = new ReportGenerationJob();
        jest.clearAllMocks();
    });

    it('aggregates preceding completed tasks with their parsed output', async () => {
		const reportTask = makeReportTask();
		const precedingTask = makeTask();
		mockWorkflow([precedingTask, reportTask]);

		const report = await job.run(reportTask);

		expect(report.workflowId).toBe('workflow-1');
		expect(report.tasks).toHaveLength(1);
		expect(report.tasks[0]).toMatchObject({
			taskId: 'task-1',
			type: 'polygonArea',
			status: 'completed',
			output: { area: 8363367, unit: 'm^2' },
		});
		expect(report.finalReport).toBe('1 of 1 preceding task(s) completed successfully');
	});

    it('returns null output for tasks with no output stored', async () => {
		const reportTask = makeReportTask();
		const taskNoOutput = makeTask({ output: null });
		mockWorkflow([taskNoOutput, reportTask]);

		const report = await job.run(reportTask);

		expect(report.tasks[0]).toMatchObject({ status: 'completed', output: null });
	});

    it('includes failed tasks with their error message in the report', async () => {
		const reportTask = makeReportTask();
		const failedTask = makeTask({ status: TaskStatus.Failed, output: null, error: 'Something went wrong' });
		mockWorkflow([failedTask, reportTask]);

		const report = await job.run(reportTask);

		expect(report.tasks[0]).toMatchObject({ status: 'failed', error: 'Something went wrong' });
	});

});
