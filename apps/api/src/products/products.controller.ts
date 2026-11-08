import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  productInputSchema,
  productQuerySchema,
  type ProductInput,
  type ProductQuery,
} from '@shop/shared';
import { AuthGuard, Roles, RolesGuard } from '../common/auth';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ProductsService } from './products.service';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'Search and list active products (paged)' })
  list(@Query(new ZodValidationPipe(productQuerySchema)) query: ProductQuery) {
    return this.products.list(query);
  }

  @Get('categories')
  @ApiOperation({ summary: 'List product categories' })
  categories() {
    return this.products.categories();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one active product' })
  get(@Param('id') id: string) {
    return this.products.get(id);
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/products')
@UseGuards(AuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'List all products including inactive (admin)' })
  list(@Query(new ZodValidationPipe(productQuerySchema)) query: ProductQuery) {
    return this.products.list(query, true);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get any product by id (admin)' })
  get(@Param('id') id: string) {
    return this.products.getAny(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a product (admin)' })
  create(@Body(new ZodValidationPipe(productInputSchema)) body: ProductInput) {
    return this.products.create(body);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a product (admin)' })
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(productInputSchema)) body: ProductInput,
  ) {
    return this.products.update(id, body);
  }

  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Deactivate a product (admin)' })
  remove(@Param('id') id: string) {
    return this.products.deactivate(id);
  }
}
