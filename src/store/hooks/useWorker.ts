import { useCallback } from 'react';
import { useAppDispatch } from '../hooks';
import { workerClient } from '../../services/workerClient';
import { 
  setProcessingStatus, 
  setProcessingProgress, 
  setProcessingError 
} from '../slices/processingSlice';
import { WorkerTaskType } from '../../workers/types';

/**
 * useWorker provides a clean way for UI components to trigger
 * background tasks and have the global Redux state updated automatically.
 */
export const useWorker = () => {
  const dispatch = useAppDispatch();

  const startTask = useCallback(async (
    type: WorkerTaskType, 
    payload?: any
  ) => {
    // 1. Reset potential previous errors and set status
    dispatch(setProcessingError('')); 
    // Map WorkerTaskType to ProcessingStatus logically
    dispatch(setProcessingStatus('idle')); // This would be more specific in a real mapping
    dispatch(setProcessingProgress(0));

    try {
      const result = await workerClient.runTask(
        type, 
        payload, 
        (progress) => {
          dispatch(setProcessingProgress(progress));
        }
      );
      
      dispatch(setProcessingStatus('complete'));
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Task failed';
      dispatch(setProcessingError(message));
      throw err;
    }
  }, [dispatch]);

  const cancelWork = useCallback(() => {
    workerClient.cancelAll();
    dispatch(setProcessingStatus('idle'));
    dispatch(setProcessingProgress(0));
    dispatch(setProcessingError('Work cancelled by user'));
  }, [dispatch]);

  return { startTask, cancelWork };
};
