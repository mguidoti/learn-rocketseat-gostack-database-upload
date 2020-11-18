import { getRepository, In } from 'typeorm';
import csvParse from 'csv-parse';
import fs from 'fs';
import Transaction from '../models/Transaction';
import Category from '../models/Category';

interface CSVTransaction {
  title: string;
  type: 'income' | 'outcome';
  value: number;
  category: string;
}
class ImportTransactionsService {
  async execute(filePath: string): Promise<Transaction[]> {
    // Create repositories for both Category and Transaction
    const categoriesRepository = getRepository(Category);
    const transactionsRepository = getRepository(Transaction);

    // Start the initial stream that reads the content of the CSV file
    const readStream = fs.createReadStream(filePath);

    // Define the parser of the CSV parser, specifying that we should ignore
    // the first line
    const csvParser = csvParse({
      from_line: 2,
    });

    // Create a pipe between the stream and the parser
    const parseCSV = readStream.pipe(csvParser);

    // Define two placeholder, used to process data
    const transactions: CSVTransaction[] = [];
    const categories: string[] = [];

    // Event listener to the parser, that, at every line, deconstruct the four
    // variables, trimming spaces
    parseCSV.on('data', async line => {
      const [title, type, value, category] = line.map((cell: string) =>
        cell.trim(),
      );

      // Checks if the non-nullable (I have to check if my category is nullable)
      // fields are in fact not null
      if (!title || !type || !value) return;

      // Save both categories and transactions to the place holder arrays
      categories.push(category);

      transactions.push({
        title,
        type,
        value,
        category,
      });
    });

    // Listen to the end of the end
    await new Promise(resolve => parseCSV.on('end', resolve));

    // Now that it's all over, checks for existing categories by bulk, using the
    // method In() from typeorm
    const existingCategories = await categoriesRepository.find({
      where: {
        title: In(categories),
      },
    });

    // Retireve only titles from the existingCategories list
    const existingCategoriesTitles = existingCategories.map(
      (category: Category) => category.title,
    );

    // Filter the categories titles that doesn't exist yet
    const addCategoryTitles = categories
      .filter(category => !existingCategoriesTitles.includes(category))
      .filter((value, index, self) => self.indexOf(value) === index);

    // Create new categories from addCategoryTitles array
    const newCategories = categoriesRepository.create(
      addCategoryTitles.map(title => ({
        title,
      })),
    );

    // Bulk save using .save() and an array
    await categoriesRepository.save(newCategories);

    // Creates a final list of categories, both existing and new
    const finalCategories = [...newCategories, ...existingCategories];

    // Create a list of transactions, using the final list of categories to
    // search and find the right category for every and each transaction
    const createdTransactions = transactionsRepository.create(
      transactions.map(transaction => ({
        title: transaction.title,
        type: transaction.type,
        value: transaction.value,
        category: finalCategories.find(
          category => category.title === transaction.category,
        ),
      })),
    );

    // Bulk save it to the database again
    await transactionsRepository.save(createdTransactions);

    // Eliminate the uploaded file
    await fs.promises.unlink(filePath);

    return createdTransactions;
  }
}

export default ImportTransactionsService;
