import { isUuid } from 'uuidv4';
import { getRepository } from 'typeorm';
import AppError from '../errors/AppError';
import Transaction from '../models/Transaction';

class DeleteTransactionService {
  public async execute(id: string): Promise<void> {
    // to do
    const transactionsRepository = getRepository(Transaction);

    if (!isUuid(id)) {
      throw new AppError('Provided id is not a valid uuid', 400);
    }

    const transaction = await transactionsRepository.find({
      where: { id },
    });

    if (transaction.length === 0) {
      throw new AppError("Provided id doesn't exist", 400);
    }

    await transactionsRepository.remove(transaction);
  }
}

export default DeleteTransactionService;
