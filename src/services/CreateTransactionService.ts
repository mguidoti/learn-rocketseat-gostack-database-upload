import { getRepository, getCustomRepository } from 'typeorm';
// import AppError from '../errors/AppError';

import Transaction from '../models/Transaction';
import Category from '../models/Category';

import TransactionRepository from '../repositories/TransactionsRepository';

interface RequestDTO {
  title: string;
  value: number;
  type: 'income' | 'outcome';
  categoryName: string;
}
class CreateTransactionService {
  public async execute({
    title,
    value,
    type,
    categoryName,
  }: RequestDTO): Promise<Transaction> {
    // Define repositories
    const transactionsRepository = getCustomRepository(TransactionRepository);
    const categoriesRepository = getRepository(Category);

    // Check if the category name has an ID
    let category = await categoriesRepository.findOne({
      where: { title: categoryName },
    });

    if (!category) {
      category = categoriesRepository.create({
        title: categoryName,
      });

      await categoriesRepository.save(category);
    }

    const category_id = category.id;

    const transaction = transactionsRepository.create({
      title,
      value,
      type,
      category_id,
    });

    await transactionsRepository.save(transaction);

    return transaction;
  }
}

export default CreateTransactionService;
