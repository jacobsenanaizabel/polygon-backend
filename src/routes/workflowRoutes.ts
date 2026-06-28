import { Router } from 'express';
import { AppDataSource } from '../data-source';
import { Workflow } from '../models/Workflow';
import { WorkflowStatus } from '../workflows/WorkflowFactory';
import { TaskStatus } from '../workers/taskRunner';

const router = Router();

router.get('/:id/status', async (req, res) => {
    try {
        const workflow = await AppDataSource.getRepository(Workflow).findOne({
            where: { workflowId: req.params.id },
            relations: ['tasks'],
        });
        if (!workflow) {
            res.status(404).json({ message: 'Workflow not found' });
            return;
        }
        res.json({
            workflowId: workflow.workflowId,
            status: workflow.status,
            completedTasks: workflow.tasks.filter(t => t.status === TaskStatus.Completed).length,
            totalTasks: workflow.tasks.length,
        });
    } catch (error) {
        console.error('Error fetching workflow status:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.get('/:id/results', async (req, res) => {
    try {
        const workflow = await AppDataSource.getRepository(Workflow).findOne({
            where: { workflowId: req.params.id },
        });
        if (!workflow) {
            res.status(404).json({ message: 'Workflow not found' });
            return;
        }
        if (workflow.status !== WorkflowStatus.Completed) {
            res.status(400).json({ message: 'Workflow not yet completed' });
            return;
        }
        res.json({
            workflowId: workflow.workflowId,
            status: workflow.status,
            finalResult: workflow.finalResult ? JSON.parse(workflow.finalResult) : null,
        });
    } catch (error) {
        console.error('Error fetching workflow results:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

export default router;
