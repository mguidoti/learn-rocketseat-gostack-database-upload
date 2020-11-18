import { getRepository, In } from 'typeorm';
import csvParse from 'csv-parse';
import fs from 'fs';
import { check } from 'prettier';
import Transaction from '../models/Transaction';
import Category from '../models/Category';
import checkCategory from '../middleware/checkCategory';
import loadCSV from '../middleware/loadDataFromCSV';
import transactionsRouter from '../routes/transactions.routes';
import TransactionsRepository from '../repositories/TransactionsRepository';

interface CSVTransaction {
  title: string;
  type: 'income' | 'outcome';
  value: number;
  categoryName: string;
  category_id: string;
}
class ImportTransactionsService {
  async execute(filePath: string): Promise<Transaction[]> {
    const categoriesRepository = getRepository(Category);
    const transactionsRepository = getRepository(Transaction);

    const readStream = fs.createReadStream(filePath);

    const csvParser = csvParse({
      from_line: 2,
    });

    const parseCSV = readStream.pipe(csvParser);

    const transactions: CSVTransaction[] = [];
    const categories: string[] = [];

    parseCSV.on('data', async line => {
      const [title, type, value, categoryName] = line.map((cell: string) =>
        cell.trim(),
      );

      if (!title || !type || !value) return;

      categories.push(categoryName);

      transactions.push({
        title,
        type,
        value,
        categoryName,
        category_id: '',
      });
    });

    await new Promise(resolve => parseCSV.on('end', resolve));

    const existentCategories = await categoriesRepository.find({
      where: {
        title: In(categories),
      },
    });

    const existentCategoriesTitles = existentCategories.map(
      (category: Category) => category.title,
    );

    const addCategoryTitles = categories
      .filter(category => !existentCategoriesTitles.includes(category))
      .filter((value, index, self) => self.indexOf(value) === index);

    const newCategories = categoriesRepository.create(
      addCategoryTitles.map(title => ({
        title,
      })),
    );

    await categoriesRepository.save(newCategories);

    const finalCategories = [...newCategories, ...existentCategories];

    // Add category_id to all transaction objects
    transactions.map((transaction: CSVTransaction) => {
      const cat = finalCategories.find(
        category => category.title === transaction.categoryName,
      );

      if (cat) {
        transaction.category_id = cat.id;
      }
    });

    const createdTransactions = transactionsRepository.create(
      transactions.map(transaction => ({
        title: transaction.title,
        type: transaction.type,
        value: transaction.value,
        category_id: transaction.category_id,
      })),
    );

    await transactionsRepository.save(createdTransactions);

    await fs.promises.unlink(filePath);

    return createdTransactions;
  }
}

export default ImportTransactionsService;
