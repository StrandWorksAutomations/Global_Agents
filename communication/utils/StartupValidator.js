import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import yaml from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class StartupValidator {
  constructor(rootPath = path.join(__dirname, '../..')) {
    this.rootPath = rootPath;
    this.errors = [];
    this.warnings = [];
  }

  async validate() {
    console.log(chalk.blue('🔍 Running startup validation...'));
    
    await this.checkNodeVersion();
    await this.checkRequiredFiles();
    await this.checkConfiguration();
    await this.checkDependencies();
    await this.checkPorts();
    await this.checkPermissions();

    this.reportResults();
    return this.errors.length === 0;
  }

  async checkNodeVersion() {
    const nodeVersion = process.version;
    const major = parseInt(nodeVersion.slice(1).split('.')[0]);
    
    if (major < 16) {
      this.errors.push({
        type: 'node_version',
        message: `Node.js version ${nodeVersion} is too old`,
        solution: 'Please upgrade to Node.js 16 or higher'
      });
    } else {
      console.log(chalk.green(`✅ Node.js ${nodeVersion} is compatible`));
    }
  }

  async checkRequiredFiles() {
    const requiredFiles = [
      'communication/package.json',
      'communication/BaseAgent.js',
      'communication/server/index.js',
      'communication/agents/TechForgeAgent.js',
      'communication/bridge/TechForgeBridge.js',
      '.techforge.yaml'
    ];

    for (const file of requiredFiles) {
      const filePath = path.join(this.rootPath, file);
      try {
        await fs.access(filePath);
        console.log(chalk.green(`✅ ${file} exists`));
      } catch (err) {
        this.errors.push({
          type: 'missing_file',
          message: `Required file not found: ${file}`,
          solution: `Please ensure ${file} exists`
        });
      }
    }
  }

  async checkConfiguration() {
    try {
      const configPath = path.join(this.rootPath, '.techforge.yaml');
      const configContent = await fs.readFile(configPath, 'utf-8');
      const config = yaml.parse(configContent);

      // Check required configuration sections
      const requiredSections = ['teams', 'integrations'];
      for (const section of requiredSections) {
        if (!config[section]) {
          this.warnings.push({
            type: 'config',
            message: `Configuration section '${section}' not found`,
            solution: `Add ${section} section to .techforge.yaml`
          });
        }
      }

      // Check communication configuration
      if (config.integrations?.communication?.real_time) {
        const rtConfig = config.integrations.communication.real_time;
        if (!rtConfig.server_url || !rtConfig.ws_url) {
          this.warnings.push({
            type: 'config',
            message: 'Communication URLs not configured',
            solution: 'Set server_url and ws_url in .techforge.yaml'
          });
        }
        console.log(chalk.green('✅ Communication configuration found'));
      }

      console.log(chalk.green('✅ Configuration file is valid'));
    } catch (err) {
      this.errors.push({
        type: 'config',
        message: `Configuration error: ${err.message}`,
        solution: 'Check .techforge.yaml syntax'
      });
    }
  }

  async checkDependencies() {
    try {
      const packagePath = path.join(this.rootPath, 'communication/package.json');
      const packageContent = await fs.readFile(packagePath, 'utf-8');
      const packageJson = JSON.parse(packageContent);

      const nodeModulesPath = path.join(this.rootPath, 'communication/node_modules');
      
      try {
        await fs.access(nodeModulesPath);
        console.log(chalk.green('✅ Dependencies installed'));
      } catch (err) {
        this.warnings.push({
          type: 'dependencies',
          message: 'Node modules not found',
          solution: 'Run: cd communication && npm install'
        });
      }

      // Check for key dependencies
      const keyDeps = ['express', 'ws', 'socket.io', 'chalk'];
      for (const dep of keyDeps) {
        if (!packageJson.dependencies?.[dep]) {
          this.errors.push({
            type: 'dependencies',
            message: `Missing key dependency: ${dep}`,
            solution: `Add ${dep} to package.json dependencies`
          });
        }
      }
    } catch (err) {
      this.errors.push({
        type: 'dependencies',
        message: `Cannot read package.json: ${err.message}`,
        solution: 'Ensure communication/package.json exists and is valid'
      });
    }
  }

  async checkPorts() {
    const ports = [3000, 8081];
    
    for (const port of ports) {
      const isInUse = await this.isPortInUse(port);
      if (isInUse) {
        this.warnings.push({
          type: 'port',
          message: `Port ${port} is already in use`,
          solution: `Stop the service on port ${port} or configure different port`
        });
      } else {
        console.log(chalk.green(`✅ Port ${port} is available`));
      }
    }
  }

  async isPortInUse(port) {
    return new Promise((resolve) => {
      const net = require('net');
      const tester = net.createServer()
        .once('error', () => resolve(true))
        .once('listening', () => {
          tester.once('close', () => resolve(false)).close();
        })
        .listen(port);
    });
  }

  async checkPermissions() {
    const paths = [
      'communication/uploads',
      'communication/logs'
    ];

    for (const dir of paths) {
      const fullPath = path.join(this.rootPath, dir);
      try {
        await fs.mkdir(fullPath, { recursive: true });
        await fs.access(fullPath, fs.constants.W_OK);
        console.log(chalk.green(`✅ ${dir} is writable`));
      } catch (err) {
        this.warnings.push({
          type: 'permissions',
          message: `Cannot write to ${dir}`,
          solution: `Check permissions for ${dir} directory`
        });
      }
    }
  }

  reportResults() {
    console.log('\n' + '='.repeat(60));
    console.log(chalk.bold('📋 VALIDATION RESULTS'));
    console.log('='.repeat(60));

    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log(chalk.green.bold('\n🎉 All checks passed! System is ready to start.'));
      return;
    }

    if (this.errors.length > 0) {
      console.log(chalk.red.bold('\n❌ ERRORS (must be fixed):'));
      this.errors.forEach((error, index) => {
        console.log(`\n${index + 1}. ${chalk.red(error.message)}`);
        console.log(`   ${chalk.cyan('Solution:')} ${error.solution}`);
      });
    }

    if (this.warnings.length > 0) {
      console.log(chalk.yellow.bold('\n⚠️  WARNINGS (recommended fixes):'));
      this.warnings.forEach((warning, index) => {
        console.log(`\n${index + 1}. ${chalk.yellow(warning.message)}`);
        console.log(`   ${chalk.cyan('Solution:')} ${warning.solution}`);
      });
    }

    console.log('\n' + '='.repeat(60));
    
    if (this.errors.length === 0) {
      console.log(chalk.green('✅ System can start (with warnings)'));
    } else {
      console.log(chalk.red('❌ System cannot start - fix errors first'));
    }
  }

  getIssues() {
    return {
      errors: this.errors,
      warnings: this.warnings
    };
  }
}