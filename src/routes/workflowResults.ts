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
			res.status(404).json({ error: 'Workflow not found' });
			return;
		}

		res.json({
			workflowId: workflow.workflowId,
			status: workflow.status,
			completedTasks: workflow.tasks.filter((t) => t.status === TaskStatus.Completed).length,
			failedTasks: workflow.tasks.filter((t) => t.status === TaskStatus.Failed).length,
			totalTasks: workflow.tasks.length,
		});
	} catch (error) {
		res.status(500).json({ error: 'Failed to retrieve workflow status' });
	}
});

router.get('/:id/results', async (req, res) => {
    try {
		const workflow = await AppDataSource.getRepository(Workflow).findOne({
			where: { workflowId: req.params.id },
		});

		if (!workflow) {
			res.status(404).json({ error: 'Workflow not found' });
			return;
		}

		if (workflow.status === WorkflowStatus.Initial || workflow.status === WorkflowStatus.InProgress) {
			res.status(400).json({ error: 'Workflow not yet completed' });
			return;
		}

		res.json({
			workflowId: workflow.workflowId,
			status: workflow.status,
			finalResult: workflow.finalResult ? JSON.parse(workflow.finalResult) : null,
		});
	} catch (error) {
		res.status(500).json({ error: 'Failed to retrieve workflow results' });
	}
});

export default router;
