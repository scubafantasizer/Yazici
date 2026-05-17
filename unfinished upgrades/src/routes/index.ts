import { Router } from 'express';
import healthRouter      from './health.js';
import chatRouter        from './chat.js';
import keysRouter        from './keys.js';
import workspaceRouter   from './workspace.js';
import projectsRouter    from './projects.js';
import filesRouter       from './files.js';
import environmentsRouter from './environments.js';
import gitRouter         from './git.js';
import templatesRouter   from './templates.js';
import systemRouter      from './system.js';
import printJobsRouter   from './print-jobs.js';

const router = Router();

router.use(healthRouter);
router.use(chatRouter);
router.use(keysRouter);
router.use(workspaceRouter);
router.use(projectsRouter);
router.use(filesRouter);
router.use(environmentsRouter);
router.use(gitRouter);
router.use(templatesRouter);
router.use(systemRouter);
router.use(printJobsRouter);

export default router;
