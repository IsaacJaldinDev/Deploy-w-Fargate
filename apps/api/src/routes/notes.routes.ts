import { Router, Request, Response, NextFunction } from 'express';
import { Note } from '../models/note.model';

const router = Router();

// GET /notes — list all notes, newest first
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const notes = await Note.findAll({ order: [['createdAt', 'DESC']] });
    res.json(notes);
  } catch (err) {
    next(err);
  }
});

// GET /notes/:id — get a single note by UUID
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const note = await Note.findByPk(req.params.id);

    if (!note) {
      res.status(404).json({ error: 'Note not found' });
      return;
    }

    res.json(note);
  } catch (err) {
    next(err);
  }
});

// POST /notes — create a new note
// Body: { title: string, description: string }
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, description } = req.body;

    // Validate required fields — return 400 with a descriptive message
    // so the Angular app (or a student testing with curl) knows what to fix
    if (!title || typeof title !== 'string' || title.trim() === '') {
      res.status(400).json({ error: 'title is required and must be a non-empty string' });
      return;
    }

    if (!description || typeof description !== 'string' || description.trim() === '') {
      res.status(400).json({ error: 'description is required and must be a non-empty string' });
      return;
    }

    const note = await Note.create({ title: title.trim(), description: description.trim() });
    res.status(201).json(note);
  } catch (err) {
    next(err);
  }
});

// PUT /notes/:id — update an existing note
// Body: { title?: string, description?: string }
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const note = await Note.findByPk(req.params.id);

    if (!note) {
      res.status(404).json({ error: 'Note not found' });
      return;
    }

    const { title, description } = req.body;

    // Only update fields that were provided — allows partial updates
    if (title !== undefined) note.title = title.trim();
    if (description !== undefined) note.description = description.trim();

    await note.save();
    res.json(note);
  } catch (err) {
    next(err);
  }
});

// DELETE /notes/:id — delete a note
// Returns 204 No Content on success (standard for DELETE — no body needed)
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const note = await Note.findByPk(req.params.id);

    if (!note) {
      res.status(404).json({ error: 'Note not found' });
      return;
    }

    await note.destroy();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
