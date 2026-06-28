import {AppDataSource} from '../data-source';
import {Task} from '../models/Task';
import {TaskRunner, TaskStatus} from './taskRunner';

export async function taskWorker() {
    const taskRepository = AppDataSource.getRepository(Task);
    const taskRunner = new TaskRunner(taskRepository);

    while (true) {
        const queuedTasks = await taskRepository.find({
            where: { status: TaskStatus.Queued },
            relations: ['workflow'],
            order: { stepNumber: 'ASC' },
        });

        let task = null;
        for (const candidate of queuedTasks) {
            if (candidate.dependsOn == null) {
                task = candidate;
                break;
            }
            const depCompleted = await taskRepository.findOne({
                where: {
                    workflow: { workflowId: candidate.workflow.workflowId },
                    stepNumber: candidate.dependsOn,
                    status: TaskStatus.Completed,
                },
                relations: ['workflow'],
            });
            if (depCompleted) {
                task = candidate;
                break;
            }
        }

        if (task) {
            try {
                await taskRunner.run(task);

            } catch (error) {
                console.error('Task execution failed. Task status has already been updated by TaskRunner.');
                console.error(error);
            }
        }

        // Wait before checking for the next task again
        await new Promise(resolve => setTimeout(resolve, 5000));
    }
}