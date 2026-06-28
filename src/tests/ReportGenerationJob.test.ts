import { ReportGenerationJob } from '../jobs/ReportGenerationJob';
import { Task } from '../models/Task';
import { TaskStatus } from '../workers/taskRunner';
import { AppDataSource } from '../data-source';

jest.mock('../data-source', () => ({
    AppDataSource: { getRepository: jest.fn() },
}));

const mockGetRepository = AppDataSource.getRepository as jest.Mock;

function makeTask(overrides: Partial<Task> = {}): Task {
    return {
        taskId: 'report-task-id',
        taskType: 'reportGeneration',
        status: 'queued',
        stepNumber: 4,
        resultId: null,
        workflow: { workflowId: 'workflow-1' },
        ...overrides,
    } as unknown as Task;
}

function makeWorkflowTask(overrides: Partial<Task> = {}): Task {
    return {
        taskId: 'task-1',
        taskType: 'polygonArea',
        status: 'completed',
        stepNumber: 1,
        resultId: 'result-1',
        workflow: { workflowId: 'workflow-1' },
        ...overrides,
    } as unknown as Task;
}

describe('ReportGenerationJob', () => {
    let job: ReportGenerationJob;

    beforeEach(() => {
        job = new ReportGenerationJob();
        jest.clearAllMocks();
    });

    it('returns a report aggregating all other tasks with their outputs', async () => {
        const precedingTask = makeWorkflowTask();
        const reportTask = makeTask();

        // taskRepo.find returns both tasks; resultRepo.findOne returns a result
        mockGetRepository
            .mockReturnValueOnce({ find: jest.fn().mockResolvedValue([precedingTask, reportTask]) }) // taskRepo
            .mockReturnValueOnce({ findOne: jest.fn().mockResolvedValue({ data: JSON.stringify({ area: 8363367, unit: 'm^2' }) }) }); // resultRepo

        const report = await job.run(reportTask) as any;

        expect(report.workflowId).toBe('workflow-1');
        expect(report.tasks).toHaveLength(1);
        expect(report.tasks[0]).toMatchObject({
            taskId: 'task-1',
            type: 'polygonArea',
            status: 'completed',
            output: { area: 8363367, unit: 'm^2' },
        });
        expect(report.finalReport).toBe('1 of 1 tasks completed');
    });

    it('returns null output for tasks with no resultId', async () => {
        const taskNoResult = makeWorkflowTask({ resultId: undefined });
        const reportTask = makeTask();

        mockGetRepository
            .mockReturnValueOnce({ find: jest.fn().mockResolvedValue([taskNoResult, reportTask]) })
            .mockReturnValueOnce({ findOne: jest.fn() });

        const report = await job.run(reportTask) as any;

        expect(report.tasks[0].output).toBeNull();
    });

    it('throws when a preceding task has failed', async () => {
        const failedTask = makeWorkflowTask({ status: TaskStatus.Failed, resultId: undefined });
        const reportTask = makeTask();

        mockGetRepository
            .mockReturnValueOnce({ find: jest.fn().mockResolvedValue([failedTask, reportTask]) })
            .mockReturnValueOnce({ findOne: jest.fn() });

        await expect(job.run(reportTask)).rejects.toThrow(
            'Cannot generate report: not all preceding tasks are completed'
        );
    });

    it('returns empty tasks array when no other tasks exist', async () => {
        const reportTask = makeTask();

        mockGetRepository
            .mockReturnValueOnce({ find: jest.fn().mockResolvedValue([reportTask]) })
            .mockReturnValueOnce({ findOne: jest.fn() });

        const report = await job.run(reportTask) as any;

        expect(report.tasks).toHaveLength(0);
        expect(report.finalReport).toBe('0 of 0 tasks completed');
    });
});
