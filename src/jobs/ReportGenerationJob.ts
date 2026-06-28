import { AppDataSource } from '../data-source';
import { Result } from '../models/Result';
import { Task } from '../models/Task';
import { Job } from './Job';


type WorkflowTask = {
    taskId: string, 
    type: string,
    status: string,
    output?: string | null
}

type Report = {
    workflowId: string,
    tasks: WorkflowTask[],
    finalReport: string
}

export class ReportGenerationJob implements Job {
    async run(task: Task): Promise<Report> {
        console.log(`Implement Report generation job ${task.taskId}...`);
        const taskRepo = AppDataSource.getRepository(Task);
        const resultRepo = AppDataSource.getRepository(Result);

        if(!taskRepo){
            throw new Error("Not find any task");
        }

        const workflowTasks = await taskRepo.find({
            where: { workflow: { workflowId: task.workflow.workflowId } },
            relations: ['workflow'],
        });

        if(!workflowTasks){
            throw new Error("Not find any workflow with this id");
        }

        const precedingTasks = workflowTasks.filter(t => t.stepNumber < task.stepNumber);
        const allPrecedingComplete = precedingTasks.every(t => t.status === 'completed');
        if (!allPrecedingComplete) {
            throw new Error('Cannot generate report: not all preceding tasks are completed');
        }

        const taskData: WorkflowTask[] = await Promise.all(
            workflowTasks
                .filter(t => t.taskId !== task.taskId)
                .map(async t => {
                    const result =  await resultRepo.findOne({ where: { resultId: t.resultId } })
                    return {
                        taskId: t.taskId,
                        type: t.taskType,
                        status: t.status,
                        output: result?.data ? JSON.parse(result.data) : null,
                    };
                })
        );


        console.log(`Final Report generation job ${taskData.filter(t => t.status === 'completed').length}...`);
        return {
            workflowId: task.workflow.workflowId,
            tasks: taskData,
            finalReport: `${taskData.filter(t => t.status === 'completed').length} of ${taskData.length} tasks completed`,
        };
    }
}
